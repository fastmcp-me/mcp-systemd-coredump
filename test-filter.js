#!/usr/bin/env node

import { execa } from 'execa';

async function testCoredumpFilter() {
  console.log('Testing coredumpctl JSON output with filtering:');
  
  try {
    // Get JSON output from coredumpctl and filter for corefile=present
    const { stdout } = await execa('coredumpctl', ['list', '--json=pretty']);
    
    // Log the raw output for debugging
    console.log('Raw coredumpctl output:');
    console.log(stdout.substring(0, 200) + '...'); // Show first 200 chars
    
    // Parse the JSON data - need to fix the format first
    // The output is not valid JSON because it's missing commas between objects
    let entries = [];

    // Clean up the JSON format by adding commas between objects
    const correctedJson = stdout
      .replace(/\}\s*\{/g, '},{')           // Add commas between objects
      .replace(/\}\s*\]/g, '}]')            // Fix end of array
      .replace(/\[\s*\{/, '[{');            // Fix start of array

    try {
      entries = JSON.parse(correctedJson);
    } catch (parseError) {
      console.error('Parse error after correction:', parseError);
      
      // Another approach - split on objects and parse each one
      const objectMatches = stdout.match(/\{[^{}]*\}/g) || [];
      console.log(`Found ${objectMatches.length} objects to parse individually`);
      
      for (const objStr of objectMatches) {
        try {
          // Replace newlines and tabs for cleaner output
          const cleanStr = objStr
            .replace(/\n/g, ' ')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ');
          
          // Add missing quotes around property names
          const fixedStr = cleanStr.replace(/([{,]\s*)([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":');
          
          entries.push(JSON.parse(fixedStr));
        } catch (e) {
          console.error('Error parsing object:', objStr);
        }
      }
    }
    
    // Filter to only show entries with corefile=present
    const presentEntries = entries.filter(entry => entry.corefile === 'present');
    
    console.log(`Total entries: ${entries.length}`);
    console.log(`Entries with corefile=present: ${presentEntries.length}`);
    
    // Show a sample entry
    if (presentEntries.length > 0) {
      console.log('Sample entry:');
      console.log(JSON.stringify(presentEntries[0], null, 2));
    } else {
      console.log('No entries with corefile=present found');
    }
  } catch (error) {
    console.error('Error:', error);
  }
}

testCoredumpFilter();
