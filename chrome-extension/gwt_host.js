#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const https = require('https');
const http = require('http');

const logFile = path.join(__dirname, 'host_log.txt');
function log(msg) {
    fs.appendFileSync(logFile, `[${new Date().toISOString()}] ${msg}\n`);
}

log("Host started");

let server = null;
let currentImagePath = null;

let inputBuffer = Buffer.alloc(0);
process.stdin.on('readable', () => {
    let chunk;
    while ((chunk = process.stdin.read()) !== null) {
        inputBuffer = Buffer.concat([inputBuffer, chunk]);
    }

    while (inputBuffer.length >= 4) {
        const msgLen = inputBuffer.readUInt32LE(0);
        const totalLen = 4 + msgLen;
        if (inputBuffer.length >= totalLen) {
            try {
                const msgJson = inputBuffer.slice(4, totalLen).toString();
                const msg = JSON.parse(msgJson);
                handleRequest(msg);
            } catch (e) {
                log(`Error parsing JSON: ${e.message}`);
            }
            inputBuffer = inputBuffer.slice(totalLen);
        } else break;
    }
});

async function handleRequest(msg) {
    if (msg.type === 'stop-server') {
        if (server) {
            server.close();
            server = null;
            log("Server stopped by request");
        }
        return;
    }

    try {
        const imageUrl = msg.url;
        const tempIn = path.join(__dirname, 'temp_in.png');
        const tempOut = path.join(__dirname, 'temp_out.png');
        
        log(`Processing image for preview...`);

        if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            fs.writeFileSync(tempIn, Buffer.from(matches[2], 'base64'));
        } else {
            await downloadFile(imageUrl, tempIn);
        }
        
        const exePath = path.join(__dirname, 'GeminiWatermarkTool.exe');
        const finalExePath = fs.existsSync(exePath) ? exePath : path.join(__dirname, '..', 'GeminiWatermarkTool.exe');
        
        const args = ['-i', tempIn, '-o', tempOut, '--remove', '--denoise', 'ai', '--threshold', '0.25', '--snap'];
        
        const gwtProcess = spawn(finalExePath, args);
        
        gwtProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(tempOut)) {
                currentImagePath = tempOut;
                startPreviewServer();
            } else {
                sendResponse({ success: false, error: "GWT process failed." });
            }
        });
    } catch (e) {
        log(`Fatal error: ${e.message}`);
        sendResponse({ success: false, error: e.message });
    }
}

function startPreviewServer() {
    if (server) server.close();

    server = http.createServer((req, res) => {
        if (currentImagePath && fs.existsSync(currentImagePath)) {
            res.writeHead(200, { 
                'Content-Type': 'image/png',
                'Access-Control-Allow-Origin': '*' // Allow extension to fetch
            });
            fs.createReadStream(currentImagePath).pipe(res);
        } else {
            res.writeHead(404);
            res.end();
        }
    });

    server.listen(0, '127.0.0.1', () => {
        const port = server.address().port;
        const previewUrl = `http://localhost:${port}/preview.png`;
        log(`Preview server started at ${previewUrl}`);
        sendResponse({ 
            success: true, 
            previewUrl: previewUrl
        });
    });

    // Auto-stop server after 5 mins
    setTimeout(() => {
        if (server) {
            server.close();
            server = null;
            log("Server auto-stopped after timeout");
        }
    }, 300000);
}

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        const protocol = url.startsWith('https') ? https : http;
        protocol.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
            res.pipe(file);
            file.on('finish', () => file.close(resolve));
        }).on('error', (err) => fs.unlink(dest, () => reject(err)));
    });
}

function sendResponse(obj) {
    const buffer = Buffer.from(JSON.stringify(obj));
    const header = Buffer.alloc(4);
    header.writeUInt32LE(buffer.length, 0);
    process.stdout.write(header);
    process.stdout.write(buffer);
}

process.stdin.resume();
