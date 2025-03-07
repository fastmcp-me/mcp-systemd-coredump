# @taskjp/server-systemd-coredump

A Model Context Protocol (MCP) server for interacting with systemd-coredump functionality. This enables MCP-capable applications to access, manage, and analyze system core dumps.

## Prerequisites

- Node.js 18+ and npm
- systemd-coredump must be installed and configured on the system
- `coredumpctl` command-line utility must be available
- For stack trace functionality: `gdb` must be installed

## Installation

### Global Installation (recommended for CLI usage)

```bash
npm install -g @taskjp/server-systemd-coredump
```

### Local Installation (for use in a project)

```bash
npm install @taskjp/server-systemd-coredump
```

## Usage

### As an MCP Server

1. Add the server to your MCP configuration file:

```json
"systemd-coredump": {
  "command": "node",
  "args": ["node_modules/@taskjp/server-systemd-coredump/build/index.js"],
  "disabled": false,
  "autoApprove": []
}
```

If installed globally:

```json
"systemd-coredump": {
  "command": "systemd-coredump-server",
  "args": [],
  "disabled": false,
  "autoApprove": []
}
```

2. Connect to it using any MCP client or language model.

### Testing with MCP Inspector

Use the MCP Inspector to test the server directly:

```bash
npx @modelcontextprotocol/inspector node_modules/@taskjp/server-systemd-coredump/build/index.js
```

Or if installed globally:

```bash
npx @modelcontextprotocol/inspector systemd-coredump-server
```

## Available Tools

The server provides the following tools:

1. **list_coredumps**: List available coredumps in the system
   - Optional parameter: `onlyPresent` (boolean) - When true, only returns coredumps with COREFILE=="present"

2. **get_coredump_info**: Get detailed information about a specific coredump
   - Required parameter: `id` (string) - ID of the coredump

3. **extract_coredump**: Extract a coredump to a file
   - Required parameters: 
     - `id` (string) - ID of the coredump
     - `outputPath` (string) - Path where to save the extracted coredump

4. **get_coredump_config**: Get the current core dump configuration of the system

5. **set_coredump_enabled**: Enable or disable core dump generation
   - Required parameter: `enabled` (boolean) - Whether to enable or disable core dumps

6. **get_stacktrace**: Get stack trace from a coredump using GDB
   - Required parameter: `id` (string) - ID of the coredump

## Available Resources

The server exposes two types of resources:

1. **Coredump Information**
   - URI format: `coredump:///<id>`
   - Returns JSON with detailed coredump information

2. **Stack Traces**
   - URI format: `stacktrace:///<id>`
   - Returns a formatted stack trace from the coredump

Where `<id>` is the unique identifier for a coredump in the format: `<timestamp>-<pid>`.

## Note on Permissions

Some operations may require elevated privileges, especially when extracting or removing coredumps. Ensure the user running the MCP server has appropriate permissions to access system coredumps.

## License

MIT
