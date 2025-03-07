#!/usr/bin/env node

/**
 * Test script to verify that URL decoding works correctly
 */

import { Client as McpServer } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the server
const SERVER_PATH = path.resolve(__dirname, 'build/index.js');

async function testUrlDecoding() {
  console.log('Starting URL decoding test...');
  
  // Create a client to connect to the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_PATH],
  });
  
  const client = new McpServer();
  await client.connect(transport);
  
  console.log('Connected to MCP server');
  
  try {
    // Test 1: List resources
    console.log('\n===== Test 1: List Resources =====');
    const resources = await client.listResources();
    console.log(`Found ${resources.length} resources`);
    
    if (resources.length === 0) {
      console.log('No resources found. Please generate a coredump first.');
      return;
    }
    
    // Get the first resource (which should be a coredump)
    const testResource = resources[0];
    console.log(`Testing with resource: ${testResource.uri}`);
    
    // Test URL with special characters
    const urlWithSpecialChars = testResource.uri;
    console.log(`\n===== Test 2: Read Resource with URI (should work after fix) =====`);
    console.log(`URI: ${urlWithSpecialChars}`);
    
    try {
      const result = await client.readResource(urlWithSpecialChars);
      console.log('✅ Success! The fix works.');
      console.log('Resource content:', result);
    } catch (error) {
      console.error('❌ Failed to read resource:', error);
    }
    
  } finally {
    // Cleanup
    await client.close();
    console.log('Test completed');
  }
}

testUrlDecoding().catch(error => {
  console.error('Test failed:', error);
  process.exit(1);
});
