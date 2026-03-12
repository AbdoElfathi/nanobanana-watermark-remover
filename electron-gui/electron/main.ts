import { app, BrowserWindow, ipcMain, dialog, protocol, net } from 'electron';
import path from 'path';
import fs from 'fs';
import { spawn } from 'child_process';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Register protocol for local images
protocol.registerSchemesAsPrivileged([
  { scheme: 'media', privileges: { bypassCSP: true, secure: true, supportFetchAPI: true, stream: true, standard: true } }
]);

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── main.js
// │ ├── dist-electron
// │ │ ├── main.js
// │ │ └── preload.js
//
process.env.DIST = path.join(__dirname, '../dist');
process.env.VITE_PUBLIC = app.isPackaged ? process.env.DIST : path.join(process.env.DIST, '../public');

let win: BrowserWindow | null;
// 🟢 'ELECTRON_RENDERER_URL' is only available in dev mode
const VITE_DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'];

function createWindow() {
  win = new BrowserWindow({
    width: 900,
    height: 700,
    icon: path.join(process.env.VITE_PUBLIC, 'favicon.ico'),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
    autoHideMenuBar: true,
    backgroundColor: '#ffffff',
  });

  // Handle local file protocol
  protocol.handle('media', (request) => {
    try {
      // Use the URL constructor to parse the incoming request
      const url = new URL(request.url);
      
      // On Windows, a URL like media://C:/path/to/img.png?t=123 
      // will have host='c:' and pathname='/path/to/img.png'
      let fullPath = decodeURIComponent(url.host + url.pathname);
      
      // If the path looks like 'c:/...', pathToFileURL handles it.
      // If it's on Linux/macOS, it might just be the pathname.
      if (process.platform !== 'win32' && !fullPath.startsWith('/')) {
        fullPath = '/' + fullPath;
      }

      const fileUrl = pathToFileURL(fullPath).toString();
      return net.fetch(fileUrl);
    } catch (e) {
      console.error('[Main] Failed to load local file:', e);
      return new Response('File not found', { status: 404 });
    }
  });

  // Test active push message to Renderer-process.
  win.webContents.on('did-finish-load', () => {
    win?.webContents.send('main-process-message', (new Date()).toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(process.env.DIST, 'index.html'));
  }
}

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
    win = null;
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

app.whenReady().then(createWindow);

// IPC Handlers
ipcMain.handle('select-files', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openFile', 'multiSelections'],
    filters: [
      { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'webp', 'bmp'] }
    ]
  });
  return result.filePaths;
});

ipcMain.handle('select-directory', async () => {
  const result = await dialog.showOpenDialog(win!, {
    properties: ['openDirectory']
  });
  return result.filePaths[0];
});

ipcMain.handle('process-files', async (event, { files, options }) => {
  const executableName = process.platform === 'win32' ? 'GeminiWatermarkTool.exe' : 'GeminiWatermarkTool';
  const rootDir = path.join(app.getAppPath(), '..');
  const exePath = path.join(rootDir, executableName);

  console.log(`[Main] Executing CLI: ${exePath}`);
  console.log(`[Main] Files to process: ${files.length}`);

  return new Promise((resolve, reject) => {
    const processFile = (file: string) => {
      return new Promise((res) => {
        const fileDir = path.dirname(file);
        const fileName = path.basename(file);
        const outputDir = path.join(fileDir, 'cleaned');
        
        if (!fs.existsSync(outputDir)) {
          fs.mkdirSync(outputDir, { recursive: true });
        }
        
        const outputFile = path.join(outputDir, fileName);

        // Advanced: gwt -i <file> -o <file> --remove ...
        const args = ['-i', file, '-o', outputFile, '--remove'];
        if (options.force) args.push('--force');
        if (options.threshold) args.push('--threshold', options.threshold.toString());
        if (options.denoise && options.denoise !== 'off') {
          args.push('--denoise', options.denoise);
        }

        console.log(`[Main] Spawning: ${exePath} ${args.join(' ')}`);
        
        const child = spawn(exePath, args, { 
          cwd: rootDir,
          shell: false
        });

        let output = '';
        child.stdout.on('data', (data) => { output += data.toString(); });
        child.stderr.on('data', (data) => { output += data.toString(); });

        child.on('error', (err) => {
          console.error(`[Main] Failed to start process: ${err.message}`);
          res({ file, outputFile: null, code: -1, output: err.message });
        });

        child.on('close', (code) => {
          console.log(`[Main] Process exited with code ${code}`);
          res({ file, outputFile, code, output });
        });
      });
    };

    Promise.all(files.map(processFile))
      .then(resolve)
      .catch(reject);
  });
});
