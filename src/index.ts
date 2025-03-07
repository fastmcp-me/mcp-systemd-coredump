#!/usr/bin/env node

/**
 * MCP server for interacting with systemd-coredump
 * Provides tools and resources to manage system core dumps
 */

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  ReadResourceRequestSchema,
  ErrorCode,
  McpError,
} from "@modelcontextprotocol/sdk/types.js";
import { execa } from 'execa';

/**
 * Type definitions for coredump information
 */
interface CoreDumpInfo {
  id: string;
  pid: string;
  uid: string;
  gid: string;
  signal: string;
  timestamp: string;
  cmdline: string;
  exe: string;
  hostname: string;
  coredump?: string; // Path to the extracted coredump file
}

/**
 * Class to interact with systemd-coredump
 */
class SystemdCoredumpManager {
  private coredumps: Map<string, CoreDumpInfo> = new Map();
  
  /**
   * List all available coredumps
   */
  async listCoredumps(): Promise<CoreDumpInfo[]> {
    try {
      const { stdout } = await execa('coredumpctl', ['list', '--no-legend']);
      
      // Parse the output
      this.coredumps.clear();
      const dumps: CoreDumpInfo[] = [];
      
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        
        // Parse the line - format is typically:
        // TIME                      PID   UID   GID SIG COREFILE EXE
        const parts = line.trim().split(/\s+/);
        if (parts.length < 7) continue;
        
        // Extract parts - this relies on coredumpctl output format
        // May need adjustment based on actual output format
        const timestamp = parts.slice(0, 2).join(' ');
        const pid = parts[2];
        const uid = parts[3];
        const gid = parts[4];
        const signal = parts[5];
        const exe = parts.slice(7).join(' ');
        
        const id = `${timestamp}-${pid}`;
        const dumpInfo: CoreDumpInfo = {
          id,
          pid,
          uid,
          gid,
          signal,
          timestamp,
          cmdline: '', // Will be populated in getCoredumpInfo if needed
          exe,
          hostname: '', // Will be populated in getCoredumpInfo if needed
        };
        
        this.coredumps.set(id, dumpInfo);
        dumps.push(dumpInfo);
      }
      
      return dumps;
    } catch (error) {
      console.error('Error listing coredumps:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to list coredumps: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Get detailed information about a specific coredump
   */
  async getCoredumpInfo(id: string): Promise<CoreDumpInfo> {
    // If we don't have the coredump in our map, refresh the list
    if (!this.coredumps.has(id)) {
      await this.listCoredumps();
      
      if (!this.coredumps.has(id)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Coredump with ID ${id} not found`
        );
      }
    }
    
    try {
      const coredump = this.coredumps.get(id)!;
      const { stdout } = await execa('coredumpctl', ['info', coredump.pid]);
      
      // Parse the detailed output
      const lines = stdout.trim().split('\n');
      for (const line of lines) {
        const [key, value] = line.split(':', 2).map(part => part.trim());
        
        if (key === 'Command Line') {
          coredump.cmdline = value;
        } else if (key === 'Hostname') {
          coredump.hostname = value;
        }
        // Could extract more info as needed
      }
      
      this.coredumps.set(id, coredump);
      return coredump;
    } catch (error) {
      console.error(`Error getting coredump info for ${id}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get coredump info: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Extract a coredump to a specified path
   */
  async extractCoredump(id: string, outputPath: string): Promise<string> {
    if (!this.coredumps.has(id)) {
      await this.listCoredumps();
      
      if (!this.coredumps.has(id)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Coredump with ID ${id} not found`
        );
      }
    }
    
    const coredump = this.coredumps.get(id)!;
    
    try {
      await execa('coredumpctl', ['dump', coredump.pid, '-o', outputPath]);
      
      // Update the coredump info with the path
      coredump.coredump = outputPath;
      this.coredumps.set(id, coredump);
      
      return outputPath;
    } catch (error) {
      console.error(`Error extracting coredump for ${id}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to extract coredump: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Remove a coredump
   */
  async removeCoredump(id: string): Promise<boolean> {
    if (!this.coredumps.has(id)) {
      await this.listCoredumps();
      
      if (!this.coredumps.has(id)) {
        throw new McpError(
          ErrorCode.InvalidParams,
          `Coredump with ID ${id} not found`
        );
      }
    }
    
    const coredump = this.coredumps.get(id)!;
    
    try {
      await execa('coredumpctl', ['delete', coredump.pid]);
      
      // Remove from our map
      this.coredumps.delete(id);
      
      return true;
    } catch (error) {
      console.error(`Error removing coredump for ${id}:`, error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to remove coredump: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
}

/**
 * Create and configure the MCP server
 */
const coredumpManager = new SystemdCoredumpManager();

const server = new Server(
  {
    name: "systemd-coredump-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      resources: {},
      tools: {},
    },
  }
);

/**
 * Handler for listing coredumps as resources.
 * Each coredump is exposed as a resource with:
 * - A coredump:// URI scheme
 * - JSON MIME type
 * - Human readable name and description
 */
server.setRequestHandler(ListResourcesRequestSchema, async () => {
  const dumps = await coredumpManager.listCoredumps();
  
  return {
    resources: dumps.map(dump => ({
      uri: `coredump:///${dump.id}`,
      mimeType: "application/json",
      name: `Coredump ${dump.pid} (${dump.exe})`,
      description: `Core dump from ${dump.exe} (PID ${dump.pid}) at ${dump.timestamp}`
    }))
  };
});

/**
 * Handler for reading coredump information.
 * Takes a coredump:// URI and returns the detailed info as JSON.
 */
server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
  const url = new URL(request.params.uri);
  const id = url.pathname.replace(/^\//, '');
  
  const coredumpInfo = await coredumpManager.getCoredumpInfo(id);
  
  return {
    contents: [{
      uri: request.params.uri,
      mimeType: "application/json",
      text: JSON.stringify(coredumpInfo, null, 2)
    }]
  };
});

/**
 * Handler that lists available tools for working with coredumps
 */
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "list_coredumps",
        description: "List all available coredumps in the system",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "get_coredump_info",
        description: "Get detailed information about a specific coredump",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID of the coredump"
            }
          },
          required: ["id"]
        }
      },
      {
        name: "extract_coredump",
        description: "Extract a coredump to a file",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID of the coredump"
            },
            outputPath: {
              type: "string",
              description: "Path where to save the extracted coredump"
            }
          },
          required: ["id", "outputPath"]
        }
      },
      {
        name: "remove_coredump",
        description: "Remove a coredump from the system",
        inputSchema: {
          type: "object",
          properties: {
            id: {
              type: "string",
              description: "ID of the coredump"
            }
          },
          required: ["id"]
        }
      }
    ]
  };
});

/**
 * Handler for coredump tools.
 * Implements various operations on coredumps.
 */
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  switch (request.params.name) {
    case "list_coredumps": {
      const dumps = await coredumpManager.listCoredumps();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(dumps, null, 2)
        }]
      };
    }
    
    case "get_coredump_info": {
      const id = String(request.params.arguments?.id);
      if (!id) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Coredump ID is required"
        );
      }
      
      const info = await coredumpManager.getCoredumpInfo(id);
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(info, null, 2)
        }]
      };
    }
    
    case "extract_coredump": {
      const id = String(request.params.arguments?.id);
      const outputPath = String(request.params.arguments?.outputPath);
      
      if (!id || !outputPath) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Coredump ID and output path are required"
        );
      }
      
      const path = await coredumpManager.extractCoredump(id, outputPath);
      
      return {
        content: [{
          type: "text",
          text: `Coredump extracted to: ${path}`
        }]
      };
    }
    
    case "remove_coredump": {
      const id = String(request.params.arguments?.id);
      
      if (!id) {
        throw new McpError(
          ErrorCode.InvalidParams,
          "Coredump ID is required"
        );
      }
      
      const removed = await coredumpManager.removeCoredump(id);
      
      return {
        content: [{
          type: "text",
          text: removed ? `Coredump ${id} removed successfully` : `Failed to remove coredump ${id}`
        }]
      };
    }
    
    default:
      throw new McpError(
        ErrorCode.MethodNotFound,
        `Unknown tool: ${request.params.name}`
      );
  }
});

/**
 * Start the server using stdio transport.
 */
async function main() {
  const transport = new StdioServerTransport();
  console.error("Starting systemd-coredump MCP server...");
  
  server.onerror = (error) => {
    console.error("Server error:", error);
  };
  
  process.on('SIGINT', async () => {
    console.error("Shutting down...");
    await server.close();
    process.exit(0);
  });
  
  await server.connect(transport);
  console.error("systemd-coredump MCP server running on stdio");
}

main().catch((error) => {
  console.error("Server error:", error);
  process.exit(1);
});
