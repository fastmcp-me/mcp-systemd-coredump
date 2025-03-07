#!/usr/bin/env node

/**
 * Test script for the stacktrace functionality of systemd-coredump-server
 */

import { spawn } from 'child_process';
import axios from 'axios';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Constants
const SERVER_PATH = path.resolve(__dirname, 'build/index.js');
const INSPECTOR_PORT = 5173;
const API_URL = `http://localhost:${INSPECTOR_PORT}/api`;

// Helper functions
async function startInspector() {
  console.log('Starting MCP inspector...');
  const inspector = spawn('npx', ['@modelcontextprotocol/inspector', SERVER_PATH], {
    stdio: 'inherit',
  });

  // Give it a moment to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return inspector;
}

async function generateCoredump() {
  console.log('Generating test coredump...');
  try {
    // Run the crash program
    await spawn('./crash', [], {
      stdio: 'inherit',
      cwd: __dirname
    });
  } catch (error) {
    // This will always throw an error since the program crashes
    console.log('Crash program executed (expected to crash)');
  }
  
  // Give systemd a moment to process the coredump
  await new Promise(resolve => setTimeout(resolve, 2000));
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

// Main test function
async function runTest() {
  let inspector;

  try {
    // Start the inspector with our server
    inspector = await startInspector();
    
    // Generate a coredump
    await generateCoredump();
    
    // List coredumps
    console.log('\n===== Test 1: List Coredumps =====');
    const listResult = await callTool('list_coredumps');
    console.log(JSON.stringify(listResult, null, 2));
    
    // Get the first coredump ID
    const coredumps = listResult?.content?.[0]?.text ? JSON.parse(listResult.content[0].text) : [];
    if (coredumps.length > 0) {
      const testDump = coredumps[0];
      console.log(`\nFound ${coredumps.length} coredumps. Testing with: ${testDump.id}`);
      
      // Test stacktrace
      console.log('\n===== Test 2: Get Stack Trace =====');
      const stacktraceResult = await callTool('get_stacktrace', { id: testDump.id });
      console.log('\nStack Trace Result:');
      if (stacktraceResult?.content?.[0]) {
        console.log(stacktraceResult.content[0].text);
      } else {
        console.log('No valid stack trace received');
        console.log(JSON.stringify(stacktraceResult, null, 2));
      }
    } else {
      console.log('\nNo coredumps found. Cannot test stacktrace feature.');
    }
    
  } catch (error) {
    console.error('Test failed:', error);
  } finally {
    // Clean up
    if (inspector) {
      console.log('Stopping inspector...');
      inspector.kill();
    }
  }
}

// Run the test
runTest().catch(console.error);
