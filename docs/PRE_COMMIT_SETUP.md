# Pre-commit Setup Guide

This project uses [pre-commit](https://pre-commit.com/) to enforce code quality checks before commits.

## Installation

1. Install pre-commit:

   ```bash
   pip install pre-commit
   ```

2. Set up git hooks:

   ```bash
   pre-commit install
   ```

## Usage

Pre-commit hooks will automatically run on `git commit`. To run hooks on all files:

```bash
pre-commit run --all-files
```

To run a specific hook:

```bash
pre-commit run eslint --all-files
pre-commit run typescript-check --all-files
```

## Hooks

- **Whitespace & Files**: Trailing whitespace, EOF fixers, merge conflict detection, large file detection, private key detection
- **Markdown Linting**: Validates markdown syntax and formatting per `.markdownlintrc.json`
- **YAML Linting**: Validates YAML syntax and formatting
- **ESLint**: TypeScript linting using local eslint configuration
- **TypeScript Check**: Type checking via `npm run check`

## Configuration

- Hooks are defined in `.pre-commit-config.yaml` with all versions pinned
- Markdown rules are in `.markdownlintrc.json`
- YAML rules are inline in `.pre-commit-config.yaml`

## CI Integration

Pre-commit runs locally on developers' machines. CI still runs the full MegaLinter compliance scan via GitHub Actions.
