# Publishing to npm and MCP Registry Setup Guide

This document describes how to configure automated publishing to npm and the MCP Registry.

## Prerequisites

1. **npm account**: You need an npm account to publish packages to the public npm registry.
2. **GitHub account**: Required for MCP Registry authentication (already configured via GitHub OIDC).
3. **Trusted publisher in npm**: You must configure npm Trusted Publishing for this repository/workflow.

## Setup Instructions

### Step 1: Configure npm Trusted Publishing

1. Sign in to [npmjs.com](https://www.npmjs.com/).
2. Open your package settings for `@downatthebottomofthemolehole/megalinter-mcp-server`.
3. Go to **Trusted publishers** and add a new GitHub Actions publisher.
4. Set:
   - **Repository owner**: `DownAtTheBottomOfTheMoleHole`
   - **Repository name**: `megalinter-mcp`
   - **Workflow filename**: `publish-mcp.yml`
   - **Environment name**: leave empty unless you use a protected environment.
5. Save the trusted publisher configuration.

### Step 2: Remove legacy token secrets (optional clean-up)

If you previously used token-based publishing, remove `NPM_TOKEN` from repository secrets.

1. Go to your [GitHub repository settings](https://github.com/DownAtTheBottomOfTheMoleHole/megalinter-mcp/settings/secrets/actions).
2. Delete the `NPM_TOKEN` secret if it exists.

### Step 3: Verify configuration

The release workflow is fully automated for `main`:

1. On push to `main`, it computes the next version and enforces strict SemVer (`x.y.z`).
2. It updates version files, commits, and tags automatically.
3. In the same workflow run, it tests, builds, publishes to npm, and publishes to the MCP Registry.
4. It creates a GitHub Release with generated, human-friendly notes grouped by change type.

Manual and tag-based publishing remain available when needed.

## Authentication Methods

### npm Publishing

- Uses npm Trusted Publishing (OIDC).
- Does not require `NPM_TOKEN`.
- Requires `id-token: write` permission in the workflow.
- Publishes with provenance via `npm publish --provenance --access public`.

### MCP Registry Publishing

- Uses GitHub OIDC (automatic, no secret required).
- Requires `id-token: write` permission (already configured in workflow).
- Server name must start with `io.github.downatthebottomofthemolehole/`.

## Troubleshooting

### "Authentication failed" on npm publish

- Confirm npm Trusted Publisher is configured for this exact repository and workflow file.
- Ensure the workflow runs from the same repository configured in npm trusted publishers.
- Verify the publish step is not using `NODE_AUTH_TOKEN`.

### "Package validation failed" on MCP Registry

- Ensure `mcpName` in [../package.json](../package.json) matches `name` in [../server.json](../server.json).
- Verify the npm package successfully published before the MCP Registry publish step.
- Check that [../server.json](../server.json) is valid according to the schema.

### "You do not have permission to publish this server"

- Server name must start with `io.github.downatthebottomofthemolehole/` when using GitHub OIDC.
- Verify you have write access to the repository.

## Version Management

Release versions must be strict SemVer: `major.minor.patch`.

- ✅ Valid: `1.0.14`
- ❌ Invalid: `1.0.14-2`, `latest`, `1.0.x`

For normal operation, merge to `main` and let automation handle versioning and publication.

For manual runs (`workflow_dispatch`), provide an explicit `x.y.z` version input.

## References

- [npm Trusted Publishing Documentation](https://docs.npmjs.com/trusted-publishers)
- [MCP Registry Publishing Guide](https://github.com/modelcontextprotocol/registry/blob/main/docs/modelcontextprotocol-io/quickstart.mdx)
