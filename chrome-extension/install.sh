#!/bin/bash

# Nanobanana Watermark Remover - macOS Installer
HOST_NAME="com.gwt.native_host"
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TARGET_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"

echo "--- Gemini Watermark Tool Setup (macOS) ---"

# 1. Detect ID (Simple check for folder name or ask)
echo "Please make sure the extension is loaded in chrome://extensions/"
read -p "Paste the Extension ID: " EXT_ID

if [ -z "$EXT_ID" ]; then
  echo "Error: Extension ID is required!"
  exit 1
fi

# 2. Create the JSON manifest
cat <<EOF > "$DIR/$HOST_NAME.json"
{
  "name": "$HOST_NAME",
  "description": "Gemini Watermark Tool Native Messaging Host",
  "path": "$DIR/gwt_host.sh",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://$EXT_ID/"
  ]
}
EOF

# 3. Ensure runner is executable
chmod +x "$DIR/gwt_host.sh"
chmod +x "$DIR/gwt_host.js"

# 4. Register with Chrome
mkdir -p "$TARGET_DIR"
cp "$DIR/$HOST_NAME.json" "$TARGET_DIR/$HOST_NAME.json"

echo "SUCCESS: Extension registered for macOS!"
echo "Note: Restart Chrome if it doesn't work immediately."
