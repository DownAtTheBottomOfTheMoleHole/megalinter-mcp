# GitHub Personal Access Token Setup

## Why is this needed?

The release workflow needs to trigger subsequent workflow runs when it creates and pushes tags. By default, the `GITHUB_TOKEN` does not trigger workflows (to prevent infinite loops). To enable the full CI/CD pipeline, you need to create a Personal Access Token (PAT) with workflow permissions.

## Setup Instructions

### 1. Create a Fine-Grained Personal Access Token

1. Go to **Settings** → **Developer settings** → **Personal access tokens** → **Fine-grained tokens**
2. Click **Generate new token**
3. Configure the token:
   - **Token name**: `MegaLinter MCP Release Workflow`
   - **Expiration**: Choose your preference (90 days or custom)
   - **Repository access**: Select "Only select repositories" → Choose `megalinter-mcp`
   - **Repository permissions**:
     - **Contents**: Read and write
     - **Metadata**: Read-only (automatically selected)
     - **Workflows**: Read and write

4. Click **Generate token**
5. **Copy the token immediately** (you won't be able to see it again)

### 2. Add Token to Repository Secrets

1. Go to your repository → **Settings** → **Secrets and variables** → **Actions**
2. Click **New repository secret**
3. Name: `PAT_TOKEN`
4. Value: Paste your token
5. Click **Add secret**

### 3. Verify the Setup

Push a commit to the `main` branch and verify:

1. The `version-and-tag` job creates a tag
2. The tag push triggers a new workflow run
3. The `test-and-build` and `publish` jobs execute

## Workflow Behaviour

### With PAT_TOKEN configured

```text
Push to main → version-and-tag creates tag → tag push triggers workflow → test-and-build + publish run
```

### Without PAT_TOKEN (fallback)

```text
Push to main → version-and-tag creates tag → tag push does NOT trigger workflow → manual intervention needed
```

## Security Notes

- The token is scoped to this repository only
- It has minimal permissions (contents + workflows)
- Rotate the token before expiration
- Never commit the token to the repository
- The workflow falls back to `GITHUB_TOKEN` if `PAT_TOKEN` is not configured (but won't trigger subsequent workflows)

## Troubleshooting

**Problem**: Tag is created but test-and-build doesn't run

- **Solution**: Verify PAT_TOKEN is set in repository secrets

**Problem**: "Resource not accessible by integration" error

- **Solution**: Check PAT has both Contents and Workflows permissions with read/write access

**Problem**: Token expired

- **Solution**: Generate a new token and update the `PAT_TOKEN` secret
