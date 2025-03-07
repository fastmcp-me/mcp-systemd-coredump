#!/bin/bash
# Example script to demonstrate the usage of the systemd-coredump MCP server

# This script requires the 'curl' and 'jq' utilities to be installed

echo "Systemd-coredump MCP Server Example Usage"
echo "=========================================="
echo

# Base URL for the MCP server (if using the inspector)
MCP_SERVER_URL="http://localhost:5173/api"

# Function to call MCP tools
call_mcp_tool() {
    local tool_name=$1
    local arguments=$2

    echo "Calling tool: $tool_name"
    echo "Arguments: $arguments"
    echo
    
    response=$(curl -s -X POST "$MCP_SERVER_URL/call_tool" \
        -H "Content-Type: application/json" \
        -d "{
            \"name\": \"$tool_name\",
            \"arguments\": $arguments
        }")
    
    echo "$response" | jq .
    echo
}

# Function to list resources
list_resources() {
    echo "Listing coredump resources"
    echo
    
    response=$(curl -s -X GET "$MCP_SERVER_URL/list_resources")
    
    echo "$response" | jq .
    echo
}

# Function to read a resource
read_resource() {
    local uri=$1
    
    echo "Reading resource: $uri"
    echo
    
    response=$(curl -s -X GET "$MCP_SERVER_URL/read_resource?uri=$uri")
    
    echo "$response" | jq .
    echo
}

echo "1. Listing all coredumps"
call_mcp_tool "list_coredumps" "{}"

echo "2. Listing resources (coredumps)"
list_resources

echo "3. Getting the current core dump configuration"
call_mcp_tool "get_coredump_config" "{}"

echo "4. Enabling core dumps (uncomment to enable)"
# call_mcp_tool "set_coredump_enabled" "{\"enabled\": true}"

echo "5. Disabling core dumps (uncomment to disable)"
# call_mcp_tool "set_coredump_enabled" "{\"enabled\": false}"

# If coredumps are available, you can uncomment these lines and replace with actual coredump ID
# COREDUMP_ID="2023-04-20 12:34:56-12345"  # Replace with an actual coredump ID
# 
# echo "6. Getting info for a specific coredump"
# call_mcp_tool "get_coredump_info" "{\"id\": \"$COREDUMP_ID\"}"
# 
# echo "7. Reading coredump resource"
# read_resource "coredump:///$COREDUMP_ID"
# 
# echo "8. Reading stack trace resource (NEW)"
# read_resource "stacktrace:///$COREDUMP_ID"
# 
# echo "9. Getting stack trace via tool"
# call_mcp_tool "get_stacktrace" "{\"id\": \"$COREDUMP_ID\"}"
# 
# echo "10. Extracting coredump to a file"
# OUTPUT_PATH="/tmp/extracted_coredump.dump"
# call_mcp_tool "extract_coredump" "{\"id\": \"$COREDUMP_ID\", \"outputPath\": \"$OUTPUT_PATH\"}"
# 
# echo "11. Removing a coredump (commented out for safety)"
# # Uncomment the next line if you really want to remove the coredump
# # call_mcp_tool "remove_coredump" "{\"id\": \"$COREDUMP_ID\"}"

echo "Example script completed."
