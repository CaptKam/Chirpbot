#!/bin/bash
# Ultra-robust server startup with automatic recovery

echo "🚀 Starting ChirpBot V2 with auto-recovery..."

# Function to start the server
start_server() {
    echo "📦 Starting server..."
    NODE_ENV=development tsx server/index.ts &
    SERVER_PID=$!
    echo "✅ Server started with PID: $SERVER_PID"
}

# Function to check if server is running
check_server() {
    if kill -0 $SERVER_PID 2>/dev/null; then
        return 0
    else
        return 1
    fi
}

# Main loop - keeps server running forever
while true; do
    start_server
    
    # Monitor the server
    while check_server; do
        sleep 10
    done
    
    echo "⚠️ Server crashed, restarting in 3 seconds..."
    sleep 3
done