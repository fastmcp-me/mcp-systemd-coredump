# Publishing Guide for systemd-coredump MCP Server

This guide provides instructions for publishing the systemd-coredump MCP server to npm.

## Prerequisites

1. You need to have an npm account
2. You need to be a member of the `modelcontextprotocol` organization on npm
3. Node.js and npm must be installed

## Pre-publication Checklist

- [ ] Update version number in `package.json` (follow semver principles)
  - **IMPORTANT:** You must increment the version number for each publication 
  - npm will reject attempts to publish an existing version
- [ ] Ensure all changes are tested and working
- [ ] Make sure the build is up-to-date (`npm run build`)
- [ ] Review the `.npmignore` file to ensure only necessary files are included

## Publishing Steps

### 1. Log in to npm

```bash
npm login
```

Follow the prompts to enter your npm username, password, and email.

### 2. Test the package contents (optional but recommended)

Check what files will be included in the published package:

```bash
npm pack
```

This will create a tarball (`.tgz` file) with exactly what would be published to npm. You can extract and examine it to make sure it contains only the necessary files.

### 3. Publish the package

```bash
npm run release
```

This runs the `release` script we added to package.json, which will:
1. Run the `prepublishOnly` script to ensure the build is up-to-date
2. Publish the package to npm with public access

Alternatively, you can run:

```bash
npm publish --access public
```

### 4. Verify the published package

Check that the package appears on npm:

```bash
npm view @modelcontextprotocol/server-systemd-coredump
```

You should also be able to see it on the npm website at:
https://www.npmjs.com/package/@modelcontextprotocol/server-systemd-coredump

## Updating the Package

To update an already published package:

1. Make your changes to the code
2. Update the version in `package.json` (following semver)
3. Run `npm run build` to update the build
4. Run `npm run release` to publish the update

## Version Management

Follow [semantic versioning](https://semver.org/) principles:

- **Patch version** (0.1.x): for backwards-compatible bug fixes
- **Minor version** (0.x.0): for new features that don't break existing functionality
- **Major version** (x.0.0): for changes that break backwards compatibility

## Common Issues

### "You need to be a member of the organization"

If you see an error like "You need to be a member of the modelcontextprotocol organization to publish this package", you need to:

1. Request access to the organization from an admin
2. Accept the invitation (check your email)
3. Try publishing again

### "You don't have permission to publish"

If you're a member but still can't publish, you may need elevated permissions within the organization. Contact an organization admin.

### npm Error 403

This may indicate that the package name is already taken or you don't have permission. Check your organization membership and the package name.
