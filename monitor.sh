#!/bin/bash
# Simple monitoring script to restart server if it crashes
while true; do
    # Check if server is running
    if ! pgrep -f "tsx server/index.ts" > /dev/null; then
        echo "🚨 Server crashed! Restarting..."
        cd /home/runner/workspace
        npm run dev &
        sleep 10
    fi
    sleep 30
done