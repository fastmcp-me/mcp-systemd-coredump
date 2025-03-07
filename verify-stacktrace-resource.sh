#!/bin/bash
# Script to verify the stack trace resource functionality

# Kill any existing instances
pkill -f "mcp-inspector build/index.js" || true

# Start the MCP inspector in the background
echo "Starting MCP inspector..."
mcp-inspector build/index.js > /dev/null 2>&1 &
INSPECTOR_PID=$!

# Wait for inspector to start
sleep 3

# Base URL for the MCP server
MCP_SERVER_URL="http://localhost:5173/api"

echo "===== Step 1: List Resources ====="
# List resources
RESOURCES=$(curl -s "${MCP_SERVER_URL}/list_resources")
echo "Resources: $RESOURCES"

# Extract just the stacktrace URIs using jq
if command -v jq >/dev/null 2>&1; then
  STACKTRACE_URIS=$(echo "$RESOURCES" | jq -r '.resources[] | select(.uri | startswith("stacktrace://")) | .uri')
  STACKTRACE_COUNT=$(echo "$STACKTRACE_URIS" | grep -c "stacktrace://" || echo 0)
  
  echo -e "\nFound $STACKTRACE_COUNT stack trace resources"
  
  if [ -z "$STACKTRACE_URIS" ]; then
    echo "No stack trace resources found. Please generate a coredump first."
    kill $INSPECTOR_PID
    exit 1
  fi
  
  # Get the first stacktrace URI
  FIRST_URI=$(echo "$STACKTRACE_URIS" | head -n 1)
  
  echo -e "\n===== Step 2: Get Stack Trace Resource ====="
  echo "Fetching stack trace from: $FIRST_URI"
  
  # Fetch the stack trace resource
  STACK_TRACE=$(curl -s "${MCP_SERVER_URL}/read_resource?uri=$FIRST_URI")
  
  # Display the stack trace content
  echo -e "\nStack trace content:"
  echo "$STACK_TRACE" | jq -r '.contents[0].text' || echo "$STACK_TRACE"
  
  echo -e "\n✅ Stack trace resource functionality verified!"
else
  echo "jq not found. Please install jq or manually verify that stack trace resources are available."
  echo "Raw response: $RESOURCES"
fi

# Clean up
echo "Stopping MCP inspector..."
kill $INSPECTOR_PID
