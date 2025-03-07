# systemd-coredump MCP Server

This MCP server provides an interface to interact with the systemd-coredump functionality via Model Context Protocol (MCP). It enables applications that support MCP to access, manage, and analyze system core dumps.

## Features

- List all available coredumps in the system
- Get detailed information about specific coredumps
- Extract coredump files to a specified location
- Remove coredumps from the system

## Prerequisites

- Node.js 18+ and npm
- systemd-coredump must be installed and configured on the system
- `coredumpctl` command-line utility must be available

## Installation

1. Clone the repository or download the source code
2. Install dependencies:

```bash
cd systemd-coredump-server
npm install
```

3. Build the server:

```bash
npm run build
```

4. Configure the MCP server by adding the following to your MCP settings configuration file:

```json
"systemd-coredump": {
  "command": "node",
  "args": ["/path/to/systemd-coredump-server/build/index.js"],
  "disabled": false,
  "autoApprove": []
}
```

## Usage

### Available Tools

The server provides the following tools:

1. **list_coredumps**: List all available coredumps in the system

   ```json
   {
     "name": "list_coredumps"
   }
   ```

2. **get_coredump_info**: Get detailed information about a specific coredump

   ```json
   {
     "name": "get_coredump_info",
     "arguments": {
       "id": "2023-04-20 12:34:56-12345"
     }
   }
   ```

3. **extract_coredump**: Extract a coredump to a file

   ```json
   {
     "name": "extract_coredump",
     "arguments": {
       "id": "2023-04-20 12:34:56-12345",
       "outputPath": "/path/to/output/core.dump"
     }
   }
   ```

4. **remove_coredump**: Remove a coredump from the system

   ```json
   {
     "name": "remove_coredump",
     "arguments": {
       "id": "2023-04-20 12:34:56-12345"
     }
   }
   ```

### Available Resources

The server exposes coredumps as resources with the following URI format:

```
coredump:///<id>
```

Where `<id>` is the unique identifier for a coredump in the format: `<timestamp>-<pid>`.

For example:

```
coredump:///2023-04-20 12:34:56-12345
```

## Note on Permissions

Some operations may require elevated privileges, especially when extracting or removing coredumps. Ensure the user running the MCP server has appropriate permissions to access system coredumps.

## License

MIT
