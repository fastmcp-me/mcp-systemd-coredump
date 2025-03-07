#!/usr/bin/env node

/**
 * Verification script for installed @modelcontextprotocol/server-systemd-coredump package
 * 
 * This script is a simple way to test that the package was installed correctly
 * by verifying we can use it to run the systemd-coredump MCP server.
 */

// This script assumes the package is installed globally.
// If installed locally, use the local path instead.
const { execSync } = require('child_process');

try {
  console.log('Verifying systemd-coredump-server installation...');
  
  // Check if the executable exists and is in PATH
  const result = execSync('which systemd-coredump-server', { encoding: 'utf8' });
  console.log(`Found executable at: ${result.trim()}`);
  
  // Get package version
  const packageJson = require('@taskjp/server-systemd-coredump/package.json');
  console.log(`Package version: ${packageJson.version}`);
  
  console.log('\nStarting MCP Inspector with systemd-coredump-server...');
  console.log('(This will open a new process - press Ctrl+C to exit when done)');
  console.log('Navigate to http://localhost:5173 in your browser to use the Inspector UI\n');
  
  // Start the MCP Inspector with the server
  execSync('npx @modelcontextprotocol/inspector systemd-coredump-server', { 
    stdio: 'inherit' 
  });
} catch (error) {
  console.error('Verification failed:', error.message);
  process.exit(1);
}
