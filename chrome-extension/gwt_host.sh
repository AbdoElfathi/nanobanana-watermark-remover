#!/bin/sh
# Runner for macOS/Linux
if [ -z "$NODE_PATH" ]; then
  NODE_PATH="/usr/local/bin/node"
fi

if [ ! -x "$NODE_PATH" ]; then
  NODE_PATH=$(which node)
fi

"$NODE_PATH" "$(dirname "$0")/gwt_host.js" "$@"
