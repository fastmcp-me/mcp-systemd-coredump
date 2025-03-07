#!/usr/bin/env node

/**
 * Direct test for the stack trace functionality in the SystemdCoredumpManager
 * This bypasses the MCP mechanism and tests the core functionality directly
 */

import { SystemdCoredumpManager } from './build/index.js';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Get the directory name
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function main() {
  try {
    // Create an instance of our manager
    const coredumpManager = new SystemdCoredumpManager();
    
    // Generate a test coredump
    console.log('Generating a test coredump...');
    try {
      execSync('./crash', { stdio: 'inherit', cwd: __dirname });
    } catch (error) {
      // This will always crash, so an error is expected
      console.log('Test program crashed as expected');
    }
    
    // Give systemd time to process the coredump
    console.log('Waiting for systemd to process the coredump...');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    // List available coredumps
    console.log('\nListing available coredumps:');
    const coredumps = await coredumpManager.listCoredumps();
    console.log(`Found ${coredumps.length} coredumps`);
    
    if (coredumps.length > 0) {
      const testDump = coredumps[0];
      console.log(`\nUsing coredump: ${testDump.id}`);
      console.log(`PID: ${testDump.pid}`);
      console.log(`Executable: ${testDump.exe}`);
      console.log(`Signal: ${testDump.signal}`);
      
      // Get the stack trace
      console.log('\nGetting stack trace...');
      try {
        const stackTrace = await coredumpManager.getStackTrace(testDump.id);
        
        console.log('\nStack trace retrieved successfully:');
        console.log(`Number of frames: ${stackTrace.frames.length}`);
        console.log(`Signal: ${stackTrace.signal}`);
        
        console.log('\nStack frames:');
        for (const frame of stackTrace.frames.slice(0, 10)) { // Show first 10 frames
          let frameOutput = `#${frame.index} `;
          
          if (frame.address) {
            frameOutput += `${frame.address} `;
          }
          
          if (frame.function) {
            frameOutput += `in ${frame.function} `;
          }
          
          if (frame.args) {
            frameOutput += `(${frame.args}) `;
          }
          
          if (frame.location) {
            frameOutput += `at ${frame.location}`;
            
            if (frame.line) {
              frameOutput += `:${frame.line}`;
            }
          }
          
          console.log(frameOutput);
        }
        
        if (stackTrace.frames.length > 10) {
          console.log(`... and ${stackTrace.frames.length - 10} more frames`);
        }
        
        console.log('\nStack trace functionality is working!');
      } catch (error) {
        console.error('\nError getting stack trace:', error);
      }
    } else {
      console.log('\nNo coredumps found. Make sure coredumps are enabled with:');
      console.log('  ulimit -c unlimited');
      console.log('  systemd-coredump should be correctly configured');
    }
  } catch (error) {
    console.error('Test failed:', error);
  }
}

main().catch(console.error);
