# Contributing

Thank you for contributing to this project.

## Before You Start

- Read [CODE_OF_CONDUCT.md](./CODE_OF_CONDUCT.md)
- Search existing issues before opening a new one
- Keep pull requests focused and small where possible

## Prerequisites

- Node.js `>=24.0.0`
- npm
- Docker or Colima for local MegaLinter runs

## Local Setup

```bash
git clone https://github.com/downatthebottomofthemolehole/megalinter-mcp.git
cd megalinter-mcp
npm install
npm run build
```

## Development Standards

- Use TypeScript and existing project conventions
- Keep changes scoped to the requested task
- Update relevant documentation when behaviour changes
- Use clear commit messages (Conventional Commit style is preferred)

## Validation Checklist

Run before opening a pull request:

```bash
npm run check
npm run build
npm audit --production
```

If Docker is available, run MegaLinter locally as well.

## Pull Request Process

1. Create a feature branch.
2. Implement and validate your changes.
3. Open a pull request using the provided template.
4. Ensure all CI checks pass.
5. Address review feedback and merge when approved.

## Security Reporting

For vulnerabilities, do not open a public issue.

Follow the process in [SECURITY.md](./SECURITY.md).
