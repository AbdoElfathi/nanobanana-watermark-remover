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
    try {
        const imageUrl = msg.url;
        const tempIn = path.join(__dirname, 'temp_in.png');
        
        // Save to Downloads folder to bypass 1MB pipe limit
        const downloadsDir = path.join(process.env.USERPROFILE, 'Downloads');
        const timestamp = Date.now();
        const outputFilename = `cleaned_gwt_${timestamp}.png`;
        const finalPath = path.join(downloadsDir, outputFilename);
        
        log(`Processing image... Target: ${finalPath}`);

        if (imageUrl.startsWith('data:')) {
            const matches = imageUrl.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
            fs.writeFileSync(tempIn, Buffer.from(matches[2], 'base64'));
        } else {
            await downloadFile(imageUrl, tempIn);
        }
        
        const exePath = path.join(__dirname, '..', 'GeminiWatermarkTool.exe');
        const args = ['-i', tempIn, '-o', finalPath, '--remove', '--denoise', 'ai', '--threshold', '0.10'];
        
        log(`Spawning: ${exePath}`);
        const gwtProcess = spawn(exePath, args);
        
        gwtProcess.on('close', (code) => {
            if (code === 0 && fs.existsSync(finalPath)) {
                log(`Success: File saved to ${finalPath}`);
                sendResponse({ 
                    success: true, 
                    filePath: finalPath,
                    fileName: outputFilename
                });
                try { fs.unlinkSync(tempIn); } catch(e){}
            } else {
                sendResponse({ success: false, error: "GWT process failed or output not found." });
            }
        });
    } catch (e) {
        log(`Fatal error: ${e.message}`);
        sendResponse({ success: false, error: e.message });
    }
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
