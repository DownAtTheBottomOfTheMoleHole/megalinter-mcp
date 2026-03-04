# Contributing to MegaLinter MCP Server

Thank you for your interest in contributing! This document provides guidelines and instructions for contributing to the project.

## Code of Conduct

Please be respectful and constructive in all interactions. We're committed to providing a welcoming and inclusive environment for all contributors.

## Getting Started

### Prerequisites

- Node.js >= 24.0.0
- npm (bundled with Node.js)
- Docker or Colima (required to test `megalinter_run` tool locally)

### Setup Development Environment

1. **Fork and clone the repository**
   ```bash
   git clone https://github.com/YOUR_USERNAME/megaliter-mcp.git
   cd megaliter-mcp
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Build the project**
   ```bash
   npm run build
   ```

4. **Run tests**
   ```bash
   npm test
   ```

## Making Changes

### Branch Naming

Use descriptive branch names following the pattern:
- `feature/description` — for new features
- `fix/description` — for bug fixes
- `docs/description` — for documentation improvements
- `chore/description` — for maintenance tasks

Example: `feature/add-verbose-output`

### Commit Messages

Follow [Conventional Commits](https://www.conventionalcommits.org/) format:

```
type(scope): description

[optional body]
[optional footer]
```

Examples:
- `feat(tools): add output truncation limit`
- `fix(runner): handle timeout correctly`
- `docs(readme): clarify Docker requirement`
- `chore(deps): bump @types/node to 25.3.3`

### Code Quality

Before committing, ensure:

1. **Types are correct:**
   ```bash
   npm run check
   ```

2. **Code builds:**
   ```bash
   npm run build
   ```

3. **Code is compliant:**
   ```bash
   # Requires Docker running
   npx mega-linter-runner --path . --config .mega-linter.yml
   ```

4. **Security audit passes:**
   ```bash
   npm audit --production
   ```

### Testing

- Add tests for new features
- Verify existing tests still pass
- Test the MCP server manually if changes involve tool signatures

Manual testing via Copilot Chat (after building):
1. Reload VS Code window (`Cmd+Shift+P` → "Developer: Reload Window")
2. Open Copilot Chat
3. Use `@megalinter-ox-security` to test tools

## Pull Request Process

1. **Update your branch with latest main:**
   ```bash
   git fetch origin
   git rebase origin/main
   ```

2. **Push your changes:**
   ```bash
   git push origin feature/my-feature
   ```

3. **Create a Pull Request:**
   - Use the PR template (auto-populated)
   - Assign appropriate labels (`feature`, `bug`, `documentation`, etc.)
   - Link related issues if applicable
   - Provide clear description of changes

4. **Address CI feedback:**
   - Resolve any lint/build errors
   - All GitHub Actions must pass before merge

5. **Wait for review:**
   - A maintainer will review your PR
   - Address any requested changes
   - Once approved, the PR can be merged

## PR Template Checklist

When creating a PR, ensure you complete the auto-populated template:
- [ ] Description of changes
- [ ] Type of change (Feature/Fix/Docs)
- [ ] Testing instructions
- [ ] All checklist items completed

## Documentation

- Update README.md for user-facing changes
- Update relevant .md files in root (TESTING.md, COMPLIANCE_AND_UPDATES.md, etc.)
- Add inline code comments for complex logic
- Follow British English spelling in documentation

## Dependency Updates

Renovate automatically creates dependency update PRs. When reviewing:
- **Patch updates** — Usually safe, auto-merged by Renovate
- **Minor updates** — Review for breaking changes, auto-merged by Renovate
- **Major updates** — Requires careful testing; manual merge required

For manual updates:
```bash
npm update
npm install PACKAGE_NAME@latest
```

Then commit with:
```bash
git commit -m "chore(deps): update dependencies"
```

## Release Process

Releases are automated via GitHub Actions. To create a release:

1. **Create a release on GitHub:**
   - Go to [Releases](../../releases)
   - Click "Draft a new release"
   - Use semantic versioning (v0.1.0, v0.2.0, v1.0.0)
   - Let GitHub auto-generate release notes from PR labels
   - Publish the release

2. **GitHub Actions will automatically:**
   - Run MegaLinter compliance scan
   - Build the project
   - Publish to GitHub Packages registry

## Questions or Need Help?

- Check existing [Issues](../../issues)
- Review [TESTING.md](./TESTING.md) for technical details
- See [COMPLIANCE_AND_UPDATES.md](./COMPLIANCE_AND_UPDATES.md) for quality standards
- Read [GITHUB_AUTOMATION.md](./GITHUB_AUTOMATION.md) for workflow details

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

---

Thank you for contributing! Your work helps make MegaLinter MCP Server better for everyone.
