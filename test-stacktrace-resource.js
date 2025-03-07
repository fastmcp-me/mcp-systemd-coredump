#!/usr/bin/env node

/**
 * Test script to verify that stack traces are properly exposed as resources
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
const INSPECTOR_PORT = 5174; // Changed from 5173 to avoid conflicts
const API_URL = `http://localhost:${INSPECTOR_PORT}/api`;

// Helper functions
async function startInspector() {
  console.log('Starting MCP inspector...');
  const inspector = spawn('npm', ['run', 'inspector'], {
    stdio: 'inherit',
    cwd: __dirname
  });

  // Give it a moment to start
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  return inspector;
}

async function listResources() {
  try {
    console.log('Listing resources...');
    const response = await axios.get(`${API_URL}/list_resources`);
    return response.data.resources || [];
  } catch (error) {
    console.error('Error listing resources:', error.message);
    return [];
  }
}

async function readResource(uri) {
  try {
    console.log(`Reading resource: ${uri}`);
    const response = await axios.get(`${API_URL}/read_resource`, {
      params: { uri }
    });
    return response.data.contents || [];
  } catch (error) {
    console.error(`Error reading resource ${uri}:`, error.message);
    if (error.response) {
      console.error('Response data:', error.response.data);
    }
    return [];
  }
}

// Main test function
async function runTest() {
  let inspector;

  try {
    // Start the inspector with our server
    inspector = await startInspector();
    
    // Step 1: List resources
    console.log('\n===== Step 1: List Resources =====');
    const resources = await listResources();
    console.log(`Found ${resources.length} resources`);
    
    // Find all stacktrace resources
    const stacktraceResources = resources.filter(resource => 
      resource.uri.startsWith('stacktrace://'));
    
    console.log(`Found ${stacktraceResources.length} stacktrace resources`);
    
    if (stacktraceResources.length === 0) {
      console.log('No stacktrace resources found. Please generate a coredump first.');
      return;
    }
    
    // Display all stacktrace resources
    console.log('\nAvailable stack trace resources:');
    stacktraceResources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.name}: ${resource.uri}`);
    });
    
    // Step 2: Read the first stacktrace resource
    const testResource = stacktraceResources[0];
    console.log(`\n===== Step 2: Read Stack Trace Resource =====`);
    console.log(`Reading: ${testResource.name} (${testResource.uri})`);
    
    const resourceContents = await readResource(testResource.uri);
    
    if (resourceContents.length > 0) {
      console.log('Stack trace content:');
      console.log(resourceContents[0].text);
      console.log('\n✅ Success! Stack trace resource functionality works.');
    } else {
      console.error('❌ No content received from stack trace resource.');
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
