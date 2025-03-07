#!/usr/bin/env node

/**
 * Test script for the systemd-coredump-server
 * This script tests all the available tools
 */

import { spawn } from 'child_process';
import axios from 'axios';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const SERVER_PATH = path.resolve(__dirname, 'build/index.js');
const INSPECTOR_PORT = 5173;
const API_URL = `http://localhost:${INSPECTOR_PORT}/api`;
const TEST_OUTPUT_PATH = path.resolve(__dirname, 'test-output.txt');

// Helper functions
async function startServer() {
  console.log('Starting server...');
  const server = spawn('node', [SERVER_PATH], {
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  server.stderr.on('data', (data) => {
    console.log(`Server stderr: ${data}`);
  });

  // Give it a moment to start
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  return server;
}

async function startInspector() {
  console.log('Starting MCP inspector...');
  const inspector = spawn('npx', ['@modelcontextprotocol/inspector', SERVER_PATH], {
    stdio: 'inherit',
  });

  // Give it a moment to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return inspector;
}

async function callTool(name, args = {}) {
  console.log(`Calling tool: ${name}`);
  try {
    const response = await axios.post(`${API_URL}/call_tool`, {
      name,
      arguments: args
    });
    return response.data;
  } catch (error) {
    console.error(`Error calling tool ${name}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return { error: error.message };
  }
}

async function listResources() {
  console.log('Listing resources...');
  try {
    const response = await axios.get(`${API_URL}/list_resources`);
    return response.data;
  } catch (error) {
    console.error('Error listing resources:', error.message);
    return { error: error.message };
  }
}

async function readResource(uri) {
  console.log(`Reading resource: ${uri}`);
  try {
    const response = await axios.get(`${API_URL}/read_resource?uri=${encodeURIComponent(uri)}`);
    return response.data;
  } catch (error) {
    console.error(`Error reading resource ${uri}:`, error.message);
    return { error: error.message };
  }
}

// Main test function
async function runTests() {
  let server;
  let inspector;
  let results = [];

  try {
    // Start the inspector with our server
    inspector = await startInspector();

    // Test 1: List tools
    console.log('\n===== Test 1: List Tools =====');
    const toolsResponse = await axios.get(`${API_URL}/list_tools`);
    results.push({ test: 'List Tools', result: toolsResponse.data });

    // Test 2: List coredumps
    console.log('\n===== Test 2: List Coredumps =====');
    const listResult = await callTool('list_coredumps');
    results.push({ test: 'List Coredumps', result: listResult });
    
    // Test 3: List resources
    console.log('\n===== Test 3: List Resources =====');
    const resourcesResult = await listResources();
    results.push({ test: 'List Resources', result: resourcesResult });
    
    // Test 4: Get core dump configuration
    console.log('\n===== Test 4: Get Core Dump Configuration =====');
    const configResult = await callTool('get_coredump_config');
    results.push({ test: 'Get Core Dump Configuration', result: configResult });
    
    // Test 5: Set core dump enabled (toggle current state)
    console.log('\n===== Test 5: Set Core Dump Enabled =====');
    const config = configResult?.content?.[0]?.text ? JSON.parse(configResult.content[0].text) : { enabled: true };
    const newEnabledState = !config.enabled;
    console.log(`Current enabled state: ${config.enabled}. Setting to: ${newEnabledState}`);
    
    const setEnabledResult = await callTool('set_coredump_enabled', { enabled: newEnabledState });
    results.push({ test: 'Set Core Dump Enabled', result: setEnabledResult });
    
    // Test 6: Restore original configuration
    console.log('\n===== Test 6: Restore Original Configuration =====');
    const restoreResult = await callTool('set_coredump_enabled', { enabled: config.enabled });
    results.push({ test: 'Restore Original Configuration', result: restoreResult });
    
    // If we have any coredumps, we can test the other tools
    const coredumps = listResult?.content?.[0]?.text ? JSON.parse(listResult.content[0].text) : [];
    
    if (coredumps.length > 0) {
      const testDump = coredumps[0];
      console.log(`\nFound ${coredumps.length} coredumps. Testing with: ${testDump.id}`);
      
      // Test 4: Get coredump info
      console.log('\n===== Test 4: Get Coredump Info =====');
      const infoResult = await callTool('get_coredump_info', { id: testDump.id });
      results.push({ test: 'Get Coredump Info', result: infoResult });
      
      // Test 5: Read coredump resource
      console.log('\n===== Test 5: Read Coredump Resource =====');
      const resourceUri = `coredump:///${testDump.id}`;
      const readResult = await readResource(resourceUri);
      results.push({ test: 'Read Coredump Resource', result: readResult });
      
      // Test 6: Extract coredump
      console.log('\n===== Test 6: Extract Coredump =====');
      const extractPath = path.resolve(__dirname, 'test-coredump.dump');
      const extractResult = await callTool('extract_coredump', { 
        id: testDump.id, 
        outputPath: extractPath 
      });
      results.push({ test: 'Extract Coredump', result: extractResult });
      
      // We don't test the remove_coredump tool directly to avoid removing actual coredumps
      console.log('\n===== Test 7: Remove Coredump (skipped) =====');
      console.log('Skipping remove_coredump test to avoid removing actual coredumps');
    } else {
      console.log('\nNo coredumps found. Skipping coredump-specific tests.');
    }
    
    // Write test results to file
    fs.writeFileSync(
      TEST_OUTPUT_PATH, 
      JSON.stringify(results, null, 2)
    );
    
    console.log(`\nAll tests completed. Results saved to ${TEST_OUTPUT_PATH}`);
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    if (inspector) {
      console.log('Stopping inspector...');
      inspector.kill();
    }
    if (server) {
      console.log('Stopping server...');
      server.kill();
    }
  }
}

// Run the tests
runTests().catch(console.error);
