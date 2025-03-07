#!/usr/bin/env node

/**
 * Simple test for the stack trace resource functionality
 * This uses the MCP SDK directly without the inspector
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to the server
const SERVER_PATH = path.resolve(__dirname, 'build/index.js');

async function main() {
  console.log('Starting simple stack trace resource test...');
  
  // Create a client connection
  const transport = new StdioClientTransport({
    command: 'node',
    args: [SERVER_PATH]
  });
  
  const client = new Client();
  
  try {
    // Connect to the server
    await client.connect(transport);
    console.log('Connected to server');
    
    // List all resources
    console.log('\nListing resources...');
    const resources = await client.listResources();
    console.log(`Found ${resources.length} resources`);
    
    // Split resources by type
    const coredumpResources = resources.filter(r => r.uri.startsWith('coredump://'));
    const stacktraceResources = resources.filter(r => r.uri.startsWith('stacktrace://'));
    
    console.log(`Found ${coredumpResources.length} coredump resources`);
    console.log(`Found ${stacktraceResources.length} stack trace resources`);
    
    if (stacktraceResources.length === 0) {
      console.log('\nNo stack trace resources found. Please generate a coredump first.');
      return;
    }
    
    // Print stack trace resources
    console.log('\nAvailable stack trace resources:');
    stacktraceResources.forEach((resource, index) => {
      console.log(`${index + 1}. ${resource.name}: ${resource.uri}`);
    });
    
    // Read the first stack trace resource
    const testResource = stacktraceResources[0];
    console.log(`\nReading stack trace: ${testResource.name}`);
    console.log(`URI: ${testResource.uri}`);
    
    const contents = await client.readResource(testResource.uri);
    
    if (contents.length > 0) {
      console.log('\nStack trace content:');
      console.log(contents[0].text);
      console.log('\n✅ Success! Stack trace resource functionality works.');
    } else {
      console.log('\n❌ No content received for stack trace resource.');
    }
    
  } catch (error) {
    console.error('Error:', error);
  } finally {
    // Close the connection
    await client.close();
    console.log('\nTest completed');
  }
}

main().catch(console.error);
