#!/usr/bin/env node

/**
 * Direct test for the coredumpctl output parsing
 */

import { execa } from 'execa';

// Mock the sample output from coredumpctl based on the desired format
// Including the size field at the end which should be ignored
// Now using "present" instead of "missing" for COREFILE
const MOCK_COREDUMPCTL_OUTPUT = `
TIME                            PID  UID  GID SIG     COREFILE EXE         SIZE
Sat 2023-06-17 01:50:45 JST    2465 1000  100 SIGABRT present  /usr/bin/cuteime 1.5M
`;

// The expected output we should get
const EXPECTED_RESULT = {
  id: 'Sat 2023-06-17 01:50:45 JST-2465',
  pid: '2465',
  uid: '1000',
  gid: '100',
  signal: 'SIGABRT',
  timestamp: 'Sat 2023-06-17 01:50:45 JST',
  cmdline: '',
  exe: '/usr/bin/cuteime',
  hostname: ''
};

/**
 * Function that mimics our updated parsing logic in SystemdCoredumpManager
 */
function parseCoredumpctlOutput(stdout) {
  console.log("Raw output:");
  console.log(stdout);
  
  const dumps = [];
  
  const lines = stdout.trim().split('\n');
  for (const line of lines) {
    if (!line.trim() || line.includes('TIME')) continue;
    
    // Parse the line - format is:
    // TIME                            PID  UID  GID SIG     COREFILE EXE      SIZE
    // Sat 2023-06-17 01:50:45 JST    2465 1000  100 SIGABRT missing  /usr/bin/cuteime 1.5M
    const parts = line.trim().split(/\s+/);
    console.log("Line parts:", parts);
    
    if (parts.length < 7) {
      console.log("Line has fewer than 7 parts, skipping");
      continue;
    }
    
    // The last part is the size (e.g., "1.5M") and should be ignored
    // Remove the last part (size)
    parts.pop();
    
    // Find the position of "missing" or "present" (COREFILE)
    const corefileIndex = parts.findIndex(p => p === "missing" || p === "present");
    if (corefileIndex === -1) {
      console.log("Line doesn't contain 'missing' or 'present', skipping");
      continue;
    }
    
    // We know SIGNAL is right before COREFILE status
    const signalIndex = corefileIndex - 1;
    // GID is before SIGNAL
    const gidIndex = signalIndex - 1;
    // UID is before GID
    const uidIndex = gidIndex - 1;
    // PID is before UID
    const pidIndex = uidIndex - 1;
    
    console.log(`Indexes - corefile: ${corefileIndex}, signal: ${signalIndex}, gid: ${gidIndex}, uid: ${uidIndex}, pid: ${pidIndex}`);
    
    // Extract values
    const pid = parts[pidIndex];
    const uid = parts[uidIndex];
    const gid = parts[gidIndex];
    const signal = parts[signalIndex];
    
    // Everything before the pid is the timestamp
    const timestamp = parts.slice(0, pidIndex).join(' ');
    
    // Everything after the COREFILE status is the executable name
    const exe = parts.slice(corefileIndex + 1).join(' ');
    
    console.log(`Extracted values - pid: ${pid}, uid: ${uid}, gid: ${gid}, signal: ${signal}, timestamp: ${timestamp}, exe: ${exe}`);
    
    const id = `${timestamp}-${pid}`;
    const dumpInfo = {
      id,
      pid,
      uid,
      gid,
      signal,
      timestamp,
      cmdline: '',
      exe,
      hostname: ''
    };
    
    dumps.push(dumpInfo);
  }
  
  return dumps;
}

async function runTest() {
  console.log('Testing coredumpctl parsing logic...');
  
  // Parse the mock output
  const dumps = parseCoredumpctlOutput(MOCK_COREDUMPCTL_OUTPUT);
  
  if (dumps.length === 0) {
    console.error('❌ Test failed: No coredumps were parsed!');
    return;
  }
  
  const parsedDump = dumps[0];
  console.log('Parsed dump:', JSON.stringify(parsedDump, null, 2));
  
  // Check if the parsed output matches the expected output
  let testPassed = true;
  for (const [key, expectedValue] of Object.entries(EXPECTED_RESULT)) {
    if (parsedDump[key] !== expectedValue) {
      console.error(`❌ Test failed: Mismatch in ${key}:`);
      console.error(`  Expected: ${expectedValue}`);
      console.error(`  Actual: ${parsedDump[key]}`);
      testPassed = false;
    }
  }
  
  if (testPassed) {
    console.log('✅ Test passed! All fields match the expected values.');
  }
}

runTest().catch(console.error);
