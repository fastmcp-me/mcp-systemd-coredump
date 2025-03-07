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
   * Get the system's core dump configuration
   * Checks core_pattern file and ulimit settings
   */
  async getCoreDumpConfig(): Promise<{
    enabled: boolean;
    corePattern: string;
    coreSizeLimit: string;
    systemdHandled: boolean;
  }> {
    try {
      // Check core_pattern in procfs
      const { stdout: corePattern } = await execa('cat', ['/proc/sys/kernel/core_pattern']);
      
      // Check ulimit setting for current shell
      const { stdout: ulimitOutput } = await execa('bash', ['-c', 'ulimit -c']);
      
      // Determine if core dumps are enabled
      const coreSizeLimit = ulimitOutput.trim();
      const systemdHandled = corePattern.trim().startsWith('|') && 
                            corePattern.includes('systemd-coredump');
      
      // Core dumps are enabled if the core size limit is not 0 and either:
      // 1. A direct file pattern is configured, or
      // 2. systemd-coredump handler is configured
      const enabled = coreSizeLimit !== '0' && 
                     (systemdHandled || (!corePattern.trim().startsWith('|')));
      
      return {
        enabled,
        corePattern: corePattern.trim(),
        coreSizeLimit,
        systemdHandled
      };
    } catch (error) {
      console.error('Error getting core dump configuration:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to get core dump configuration: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
  /**
   * Enable or disable core dump generation
   */
  async setCoreDumpEnabled(enabled: boolean): Promise<boolean> {
    try {
      const currentConfig = await this.getCoreDumpConfig();
      
      // Set core size limit using ulimit
      // This requires sudo for system-wide configuration
      // Or can be done in user's shell for user-level configuration
      const limitValue = enabled ? 'unlimited' : '0';
      await execa('bash', ['-c', `ulimit -c ${limitValue}`]);
      
      // Also set the soft limit in current shell
      await execa('bash', ['-c', `ulimit -S -c ${limitValue}`]);
      
      // Verify the change
      const newConfig = await this.getCoreDumpConfig();
      
      // For system-wide permanent configuration, we'd ideally update 
      // /etc/security/limits.conf, but that requires root privileges
      // Here we just return if our immediate change was successful
      return newConfig.enabled === enabled;
    } catch (error) {
      console.error('Error setting core dump enabled:', error);
      throw new McpError(
        ErrorCode.InternalError,
        `Failed to ${enabled ? 'enable' : 'disable'} core dumps: ${error instanceof Error ? error.message : String(error)}`
      );
    }
  }
  
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
        // TIME                            PID  UID  GID SIG     COREFILE EXE
        // Sat 2023-06-17 01:50:45 JST    2465 1000  100 SIGABRT missing  /usr/bin/cuteime
        const parts = line.trim().split(/\s+/);
        if (parts.length < 7) continue;
        
        // Find the position of "missing" or "present" (COREFILE)
        let corefileIndex = parts.indexOf("missing");
        if (corefileIndex === -1) {
          // If "missing" isn't found, try looking for "present"
          corefileIndex = parts.indexOf("present");
          if (corefileIndex === -1) continue;
        }
        
        // We know SIGNAL is right before "missing"/"present"
        const signalIndex = corefileIndex - 1;
        // GID is before SIGNAL
        const gidIndex = signalIndex - 1;
        // UID is before GID
        const uidIndex = gidIndex - 1;
        // PID is before UID
        const pidIndex = uidIndex - 1;
        
        // Extract values based on their position relative to COREFILE
        const pid = parts[pidIndex];
        const uid = parts[uidIndex];
        const gid = parts[gidIndex];
        const signal = parts[signalIndex];
        
        // Everything before the pid is the timestamp
        const timestamp = parts.slice(0, pidIndex).join(' ');
        
        // Everything after the COREFILE is the executable name
        const exe = parts.slice(corefileIndex + 1).join(' ');
        
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
      },
      {
        name: "get_coredump_config",
        description: "Get the current core dump configuration of the system",
        inputSchema: {
          type: "object",
          properties: {},
          required: []
        }
      },
      {
        name: "set_coredump_enabled",
        description: "Enable or disable core dump generation",
        inputSchema: {
          type: "object",
          properties: {
            enabled: {
              type: "boolean",
              description: "Whether to enable (true) or disable (false) core dumps"
            }
          },
          required: ["enabled"]
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
    
    case "get_coredump_config": {
      const config = await coredumpManager.getCoreDumpConfig();
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            enabled: config.enabled,
            corePattern: config.corePattern,
            coreSizeLimit: config.coreSizeLimit,
            systemdHandled: config.systemdHandled,
            message: `Core dumps are currently ${config.enabled ? 'ENABLED' : 'DISABLED'}`
          }, null, 2)
        }]
      };
    }
    
    case "set_coredump_enabled": {
      const enabled = Boolean(request.params.arguments?.enabled);
      
      const success = await coredumpManager.setCoreDumpEnabled(enabled);
      
      return {
        content: [{
          type: "text",
          text: success 
            ? `Core dumps have been successfully ${enabled ? 'enabled' : 'disabled'}`
            : `Failed to ${enabled ? 'enable' : 'disable'} core dumps`
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
