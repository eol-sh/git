#!/bin/bash

# Test script to demonstrate the simplified Git server working with curl

echo "🚀 Starting Git server in background..."

# Start the server in background
deno run --allow-env --allow-net --allow-read --allow-write examples/git-server-simple.ts &
SERVER_PID=$!

# Wait for server to start
sleep 3

echo "📡 Testing server health..."
curl -s http://localhost:8000/health | jq .

echo -e "\n📂 Testing repository initialization..."
curl -X POST http://localhost:8000/repos/test-repo \
  -H "Content-Type: application/json" \
  -d '{"operation": "init", "defaultBranch": "main"}' | jq .

echo -e "\n📋 Listing repositories..."
curl -s http://localhost:8000/repos | jq .

echo -e "\n🔍 Getting repository status..."
curl -s http://localhost:8000/repos/test-repo/status | jq .

echo -e "\n🛑 Stopping server..."
kill $SERVER_PID

echo -e "\n✅ Test completed! The simplified Git server can successfully initialize repositories via curl."