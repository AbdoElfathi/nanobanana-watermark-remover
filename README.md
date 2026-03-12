# Nanobanana Watermark Remover (Fork of Gemini Watermark Tool)

[![C++20](https://img.shields.io/badge/C++-20-blue.svg)](https://en.cppreference.com/w/cpp/20)
[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](LICENSE)
[![GitHub](https://img.shields.io/badge/GitHub-Repo-blue?logo=github)](https://github.com/AbdoElfathi/nanobanana-watermark-remover)

This project is a specialized fork of **Gemini Watermark Tool**, enhanced with modern web-integrated workflows. It combines the powerful original C++ restoration engine with a brand new Electron desktop application and a Chrome extension for a seamless watermark removal experience.

---

## 🚀 What's New in This Fork

While the original tool provided a powerful CLI and a C++ GUI, this fork focuses on **accessibility** and **web integration**:

### 1. Modern Electron Desktop App (`/electron-gui`)
A minimalist, light-mode desktop application built with React and Electron.
- **Batch Processing**: Drag and drop multiple images or entire folders.
- **Before/After Comparison**: Click on any processed thumbnail to toggle between the original and cleaned version instantly.
- **Non-Destructive**: Automatically saves processed images to a `cleaned/` sub-folder, preserving your originals.
- **Real-time Progress**: Visual feedback and logs for batch operations.

### 2. Chrome Extension (`/chrome-extension`)
A "Right-Click to Remove" experience for the web.
- **Instant Processing**: Right-click any image on any website (including chats and protected views) to remove the watermark.
- **Smart Fetching**: Uses Offscreen Documents and tab-context fallbacks to bypass CORS and protected image restrictions.
- **Interactive Preview**: Shows a high-quality preview modal directly in your tab before you decide to download.
- **Snap Engine Integration**: Automatically corrects for resized or shifted watermarks commonly found in web previews.
- **One-Click Installer**: Includes a PowerShell script (`install.ps1`) that auto-detects the extension ID and registers the native bridge.

---

## 🛠️ Implementation Details

- **Native Messaging Bridge**: A Node.js host connects the Chrome extension to the local C++ engine.
- **Local Preview Server**: The native host starts a temporary HTTP server to serve high-resolution processed images to the browser without hitting memory limits.
- **Advanced CLI Integration**: The Electron app and Chrome extension use the latest `--snap` and `--denoise ai` features of the core engine for maximum quality.

---

## 🏗️ Based on Gemini Watermark Tool (Original)

This fork relies on the mathematical restoration method and AI denoise core implemented in the original [GeminiWatermarkTool](https://github.com/allenk/GeminiWatermarkTool) by **Allen Kuo**.

### Original Core Features:
- **Deterministic Reconstruction**: Uses reverse alpha blending to mathematically invert the watermark overlay.
- **AI Denoise**: GPU-accelerated FDnCNN neural network (via NCNN + Vulkan) for cleaning up residual artifacts.
- **Smart Detection**: Three-stage NCC detection to automatically identify and locate watermarks.
- **Cross-Platform Core**: High-performance C++20 engine.

---

## 📦 Getting Started

### For the Electron App:
1. Ensure `GeminiWatermarkTool.exe` is in the root folder.
2. Navigate to `electron-gui/`.
3. Run `npm install` then `npm run dev`.

### For the Chrome Extension:
1. Copy `GeminiWatermarkTool.exe` into the `chrome-extension/` folder.
2. Load the `chrome-extension/` folder in `chrome://extensions/` (Developer Mode).
3. Right-click `install.ps1` and **Run with PowerShell** to link the extension to the local engine.

---

## ⚠️ Credits & Legal

**Original Author**: Allen Kuo ([@allenk](https://github.com/allenk))
The core C++ engine, reverse alpha-blending logic, and mask assets are the work of the original author and are used here under the **MIT License**.

**Fork Author**: AbdoElfathi
Implementation of the Electron GUI, Chrome Extension, and Native Bridge.

*This tool is for personal and educational use. Always respect copyright and terms of service when processing images.*
