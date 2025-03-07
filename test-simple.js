#!/usr/bin/env node

/**
 * Simple test script for the systemd-coredump-server
 * Directly tests the MCP server without using the inspector UI
 */

import { Client as McpServer } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import { spawn } from 'child_process';
import { fileURLToPath } from 'url';
import path from 'path';
import fs from 'fs';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the server
const SERVER_PATH = path.resolve(__dirname, 'build/index.js');
const TEST_OUTPUT_PATH = path.resolve(__dirname, 'test-results.json');

async function runTests() {
  console.log('Starting systemd-coredump MCP server...');
  
  const serverProcess = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe', 'ipc']
  });
  
  // Capture server output for debugging
  serverProcess.stdout.on('data', (data) => {
    console.log(`Server stdout: ${data}`);
  });
  
  serverProcess.stderr.on('data', (data) => {
    console.log(`Server stderr: ${data}`);
  });
  
  // Wait a bit for the server to start up
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create a client to connect to the server
  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_PATH],
  });
  
  const client = new McpServer();
  await client.connect(transport);
  
  console.log('Connected to MCP server');
  
  const results = [];
  
  try {
    // Test 1: List tools
    console.log('\n===== Test 1: List Tools =====');
    const tools = await client.listTools();
    console.log('Available tools:');
    tools.forEach(tool => {
      console.log(`- ${tool.name}: ${tool.description}`);
    });
    results.push({ test: 'List Tools', result: tools });
    
    // Test 2: List coredumps
    console.log('\n===== Test 2: List Coredumps =====');
    try {
      const listResult = await client.callTool('list_coredumps', {});
      console.log('Result:', listResult);
      results.push({ test: 'List Coredumps', result: listResult });
      
      // Test 3: List resources
      console.log('\n===== Test 3: List Resources =====');
      const resources = await client.listResources();
      console.log('Available resources:');
      resources.forEach(resource => {
        console.log(`- ${resource.uri}: ${resource.name}`);
      });
      results.push({ test: 'List Resources', result: resources });
      
      // Parse coredumps from the list result
      const coredumps = listResult.content?.[0]?.text ? 
        JSON.parse(listResult.content[0].text) : [];
      
      if (coredumps.length > 0) {
        const testDump = coredumps[0];
        console.log(`\nFound ${coredumps.length} coredumps. Testing with: ${testDump.id}`);
        
        // Test 4: Get coredump info
        console.log('\n===== Test 4: Get Coredump Info =====');
        const infoResult = await client.callTool('get_coredump_info', { id: testDump.id });
        console.log('Result:', infoResult);
        results.push({ test: 'Get Coredump Info', result: infoResult });
        
        // Test 5: Read coredump resource
        console.log('\n===== Test 5: Read Coredump Resource =====');
        const resourceUri = `coredump:///${testDump.id}`;
        const readResult = await client.readResource(resourceUri);
        console.log('Result:', readResult);
        results.push({ test: 'Read Coredump Resource', result: readResult });
        
        // Test 6: Extract coredump (skipped in simple test to avoid file I/O)
        console.log('\n===== Test 6: Extract Coredump (skipped) =====');
        console.log('Skipping extract_coredump test in simple test to avoid file I/O');
        
        // Test 7: Remove coredump (skipped to avoid data loss)
        console.log('\n===== Test 7: Remove Coredump (skipped) =====');
        console.log('Skipping remove_coredump test to avoid removing actual coredumps');
      } else {
        console.log('\nNo coredumps found. Skipping coredump-specific tests.');
      }
    } catch (error) {
      console.error('Error during tests:', error);
      results.push({ test: 'Error', error: error.toString() });
    }
    
    // Write results to file
    fs.writeFileSync(
      TEST_OUTPUT_PATH, 
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\nAll tests completed. Results saved to ${TEST_OUTPUT_PATH}`);
    
  } finally {
    // Cleanup
    await client.close();
    serverProcess.kill();
    console.log('MCP server stopped');
  }
}

runTests().catch(console.error);
