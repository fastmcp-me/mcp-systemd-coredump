# How to Join the `modelcontextprotocol` npm Organization

To publish packages under the `@modelcontextprotocol` scope on npm, you need to be a member of the organization. Here's how to join:

## Option 1: Join as a Contributor

### 1. Create an npm Account

If you don't already have an npm account:
- Go to [npmjs.com](https://www.npmjs.com/)
- Click on "Sign Up" and follow the registration process
- Verify your email address

### 2. Contact the Organization Admin

The Model Context Protocol organization is managed by the core team. To request membership:

- Send an email to modelcontextprotocol@example.com (replace with the actual contact email)
- Include your npm username and a brief description of your involvement with the project
- Explain why you need publishing access

### 3. Accept the Invitation

If approved:
- You'll receive an email invitation to join the organization
- Follow the link in the email to accept the invitation
- Once accepted, you'll be a member of the organization

## Option 2: Create Your Own Scope

If you prefer to publish under your own scope rather than joining the existing organization:

1. Create a personal or organization scope:
   ```bash
   # For a personal scope (e.g., @yourusername/server-systemd-coredump)
   npm login
   ```

2. Update the package name in package.json to use your scope:
   ```json
   {
     "name": "@yourusername/server-systemd-coredump",
     ...
   }
   ```

3. Publish with your scope:
   ```bash
   npm publish --access public
   ```

## Option 3: Publish Without a Scope

If you don't need to use the `@modelcontextprotocol` scope:

1. Remove the scope from the package name in package.json:
   ```json
   {
     "name": "systemd-coredump-server",
     ...
   }
   ```

2. Check if the name is available:
   ```bash
   npm search systemd-coredump-server
   ```

3. If available, publish without a scope:
   ```bash
   npm publish --access public
   ```

## Important Notes

- Organization membership typically requires approval from an admin
- You can still contribute to the project without being a member of the npm organization
- If you're creating a fork or variant, consider using your own scope to avoid confusion
- When publishing packages related to established projects, it's best practice to coordinate with the project maintainers

## Alternative: GitHub Packages

As an alternative to npm, you can also publish to GitHub Packages if your project is hosted on GitHub:

1. Set up authentication for GitHub Packages
2. Configure your package.json with the GitHub registry
3. Use `npm publish` to publish to GitHub Packages

For detailed instructions, see [GitHub's documentation on publishing packages](https://docs.github.com/en/packages/working-with-a-github-packages-registry/working-with-the-npm-registry).
