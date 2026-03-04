# MegaLinter Compliance & Renovate Setup

## MegaLinter Configuration

This repository uses **MegaLinter** via the [Ox Security MegaLinter Action](https://github.com/oxsecurity/megalinter-action) to enforce comprehensive code quality and compliance standards before releases and PRs.

### Configuration

**File:** [.mega-linter.yml](.mega-linter.yml)

The configuration enforces:
- **Markdown linting** — Consistent formatting and structure
- **JSON validation** — Valid JSON in all configuration files
- **YAML validation** — Proper YAML syntax in workflows and configs
- **TypeScript linting** — Code style and type safety
- **Bash linting** — Shell script quality
- **Spell checking** — Correct spelling in code and documentation

### Linter Integration in GitHub Workflows

**CI Workflow (`.github/workflows/ci.yml`)**
- Runs on every pull request and push to `main` or `develop`
- Executes **MegaLinter Compliance Scan** job
- Fails the build if ANY errors are found (`FAIL_IF_ERRORS: true`)
- Uploads reports as CI artifacts for review

**Publish Workflow (`.github/workflows/publish.yml`)**
- Runs **Compliance job BEFORE publishing**
- The `publish` job depends on `compliance` job success (`needs: compliance`)
- Prevents publishing non-compliant code to GitHub Packages
- Uploads compliance reports as release artifacts

### Local Compliance Testing

To test compliance locally before pushing:

```bash
# Build the project (required before linting)
npm run build

# Run MegaLinter via Docker (requires Docker to be running)
npx mega-linter-runner --path . --config .mega-linter.yml
```

If Docker isn't available, you can still catch most issues with:

```bash
npm run check  # TypeScript type checking
npm audit      # Security audit
```

### Customizing MegaLinter Rules

Edit [.mega-linter.yml](.mega-linter.yml) to:
- Enable/disable specific linters
- Adjust validation levels
- Exclude directories (e.g., `node_modules`, `dist`)
- Configure report output

Reference: [MegaLinter Documentation](https://megalinter.io/latest/)

---

## Renovate Configuration

This repository uses **Renovate** to automatically manage and update dependencies, keeping the project secure and up-to-date.

### Configuration

**File:** [renovate.json](renovate.json)

Renovate is configured with:
- **Automated dependency updates** — PRs for new versions
- **Grouped updates** — Core, DevDeps, GitHub Actions bundled
- **Smart merging** — Patch updates auto-merged, major versions require review
- **Security alerts** — Auto-labeled for immediate attention
- **Scheduled updates** — Batched Monday mornings (UTC) to avoid notification fatigue
- **Semantic commits** — Follows conventional commit format

### Update Strategy by Type

| Update Type | Auto-Merge | Labels | Notes |
|:--|:--|:--|:--|
| **Patch** | ✅ Yes | `maintenance` | Auto-merged via squashed PR |
| **Minor** | ✅ Yes | `feature` | Feature-safe; auto-merged with passing CI |
| **Major** | ❌ No | `breaking-change` | Requires manual review and testing |
| **Security** | ❌ No | `security` | Team assignment for immediate review |
| **GitHub Actions** | ✅ Yes | n/a | Auto-merged as safe |

### Grouped Dependency Updates

1. **Node.js & Core Dependencies**
   - `@modelcontextprotocol/sdk`
   - `typescript`, `tsx`
   - `@types/node`
   - Update schedule: Sunday & Wednesday evenings (UTC)

2. **DevDependencies**
   - All development-only packages
   - Update schedule: Sunday & Wednesday evenings (UTC)

3. **GitHub Actions**
   - All `actions/` dependencies (checkout, setup-node, etc.)
   - Auto-merged with squash strategy

### Enabling Renovate in GitHub

Renovate is configured via `renovate.json`. To activate:

1. **Install Renovate App**
   - Visit [app.renovatebot.com](https://app.renovatebot.com/)
   - Select the GitHub org/repo
   - Install and authorize

2. **Renovate will automatically:**
   - Create a "Renovate Configuration" PR in your repo
   - Open dependency update PRs on the configured schedule
   - Label and track vulnerable packages
   - Post comments with update details

### Manual Dependency Updates

If you prefer to manually update dependencies:

```bash
# Check for updates
npm outdated

# Install latest versions
npm update

# Install latest major versions (use with caution)
npm install @package-name@latest
```

Then commit the updated `package-lock.json`:

```bash
git add package.json package-lock.json
git commit -m "chore: upd dependencies"
```

### Renovate Behavior Examples

**Example 1: Patch Update → Auto-Merge**
```
📦 Update @modelcontextprotocol/sdk 1.27.1 → 1.27.2 (patch)
  ✅ Auto-merged as: "chore(deps): update @modelcontextprotocol/sdk to 1.27.2"
```

**Example 2: Minor Update → Manual Review**
```
📦 Update typescript 5.9.3 → 5.10.0 (minor)
  🔍 Requires manual review (may include new features)
  Label: feature
```

**Example 3: Security Update → Assigned**
```
🚨 Security: @package-name has vulnerability CVE-XXXX
  👤 Assigned to @owner for immediate attention
  Label: security
```

### Monitoring Renovate Activity

- Check for active Renovate PRs: https://github.com/DownAtTheBottomOfTheMoleHole/megaliter-mcp/pulls
- View Renovate bot activity: https://github.com/DownAtTheBottomOfTheMoleHole/megaliter-mcp/commits?author=renovate
- Troubleshoot: See PR comments from `@renovatebot` for details

---

## Integration with Release Workflow

When you create a new **GitHub Release**:

1. The `publish.yml` workflow triggers
2. **Compliance job runs first** (MegaLinter scan)
   - If compliance fails, the publish job is skipped
   - No non-compliant code reaches GitHub Packages
3. **Publish job runs** (only if compliance passes)
4. Package is published to GitHub Packages registry

This ensures every released version is fully compliant with code quality standards.

---

## References

- [MegaLinter Documentation](https://megalinter.io/latest/)
- [Ox Security MegaLinter Action](https://github.com/oxsecurity/megalinter-action)
- [Renovate Documentation](https://docs.renovatebot.com/)
- [Renovate Configuration Reference](https://docs.renovatebot.com/configuration-options/)
