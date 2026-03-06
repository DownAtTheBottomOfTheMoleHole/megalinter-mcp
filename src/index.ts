#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import {
  type ToolArgs,
  formatOutput,
  readBool,
  readNumber,
  readString,
  readStringArray,
  resolveRunnerPackage,
} from "./utils.js";

const DEFAULT_FLAVOR = "all";
const DEFAULT_RELEASE = "v9";
const DEFAULT_REPORTS_PATH = "megalinter-reports";
const DEFAULT_TIMEOUT_SECONDS = 3600;

const KNOWN_FLAVORS = [
  "all",
  "c_cpp",
  "ci_light",
  "cupcake",
  "documentation",
  "dotnet",
  "dotnetweb",
  "formatters",
  "go",
  "java",
  "javascript",
  "php",
  "python",
  "ruby",
  "rust",
  "salesforce",
  "security",
  "swift",
  "terraform",
];

type ProcessResult = {
  exitCode: number;
  stdout: string;
  stderr: string;
  timedOut: boolean;
};

type LinterInfo = {
  name: string;
  language: string;
  category: "lint" | "format" | "security" | "quality";
  description: string;
  isSecurity: boolean;
  isAutoFix: boolean;
  securityCategories?: ("sast" | "secrets" | "supply-chain" | "container" | "infrastructure")[];
};

type ReporterInfo = {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  outputFormat?: string;
  requiresCI?: string;
};

type Issue = {
  file?: string;
  line?: number;
  column?: number;
  rule?: string;
  message?: string;
  severity?: "error" | "warning" | "info";
  linter?: string;
  fix?: string;
};

type IssueSummary = {
  totalIssues: number;
  bySeverity: Record<string, number>;
  byLinter: Record<string, number>;
  byCategory: Record<string, number>;
  criticalSecurity: Issue[];
  topIssues: Issue[];
};

type ReportMetadata = {
  timestamp?: string;
  linters_applied?: string[];
  summary?: {
    total_badges_errors?: number;
    total_badges_warnings?: number;
    status?: string;
  };
  linter_runs?: Array<{
    linter_name?: string;
    status?: string;
  }>;
};

// Comprehensive linter metadata from MegaLinter documentation
const LINTER_CATALOG: Record<string, LinterInfo> = {
  // SAST Linters
  REPOSITORY_SEMGREP: {
    name: "Semgrep",
    language: "multi",
    category: "security",
    description: "Static analysis engine for finding bugs, security issues, and antipatterns",
    isSecurity: true,
    isAutoFix: true,
    securityCategories: ["sast"],
  },
  PYTHON_BANDIT: {
    name: "Bandit",
    language: "python",
    category: "security",
    description: "Security issue scanner for Python code",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["sast"],
  },
  REPOSITORY_DEVSKIM: {
    name: "DevSkim",
    language: "multi",
    category: "security",
    description: "Security focused static analysis tool",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["sast"],
  },
  // Secrets Detection
  REPOSITORY_GITLEAKS: {
    name: "Gitleaks",
    language: "repository",
    category: "security",
    description: "Scans repositories for secrets like credentials",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["secrets"],
  },
  REPOSITORY_SECRETLINT: {
    name: "Secretlint",
    language: "repository",
    category: "security",
    description: "Linter to find and prevent passwords and other secrets",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["secrets"],
  },
  REPOSITORY_TRUFFLEHOG: {
    name: "Trufflehog",
    language: "repository",
    category: "security",
    description: "Finds and verifies credentials",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["secrets"],
  },
  // Supply Chain & Vulnerability Scanning
  REPOSITORY_TRIVY: {
    name: "Trivy",
    language: "repository",
    category: "security",
    description: "Vulnerability scanner for dependencies and container images",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["supply-chain", "container"],
  },
  REPOSITORY_GRYPE: {
    name: "Grype",
    language: "repository",
    category: "security",
    description: "Container/artifact vulnerability scanner",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["supply-chain", "container"],
  },
  // Container Security
  DOCKERFILE_HADOLINT: {
    name: "Hadolint",
    language: "dockerfile",
    category: "security",
    description: "Linter for Dockerfile best practices and security",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["container"],
  },
  KUBERNETES_KUBESCAPE: {
    name: "Kubescape",
    language: "kubernetes",
    category: "security",
    description: "Kubernetes security posture management tool",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["infrastructure"],
  },
  // Infrastructure as Code Security
  TERRAFORM_TFLINT: {
    name: "TFLint",
    language: "terraform",
    category: "security",
    description: "Terraform linter with security checks",
    isSecurity: true,
    isAutoFix: true,
    securityCategories: ["infrastructure"],
  },
  TERRAFORM_TERRASCAN: {
    name: "Terrascan",
    language: "terraform",
    category: "security",
    description: "Infrastructure-as-code security scanning",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["infrastructure"],
  },
  ANSIBLE_ANSIBLE_LINT: {
    name: "Ansible-lint",
    language: "ansible",
    category: "security",
    description: "Ansible playbook linter with security policies",
    isSecurity: true,
    isAutoFix: true,
    securityCategories: ["infrastructure"],
  },
  CLOUDFORMATION_CFN_LINT: {
    name: "cfn-lint",
    language: "cloudformation",
    category: "security",
    description: "CloudFormation linter with security checks",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["infrastructure"],
  },
  REPOSITORY_CHECKOV: {
    name: "Checkov",
    language: "infrastructure",
    category: "security",
    description: "Infrastructure-as-code security scanning framework",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["infrastructure", "supply-chain"],
  },
  REPOSITORY_KICS: {
    name: "KICS",
    language: "infrastructure",
    category: "security",
    description: "Infrastructure configuration secrets scanning",
    isSecurity: true,
    isAutoFix: false,
    securityCategories: ["infrastructure"],
  },
  // General Linters
  JAVASCRIPT_ESLINT: {
    name: "ESLint",
    language: "javascript/typescript",
    category: "lint",
    description: "Find and fix problems in JavaScript code",
    isSecurity: false,
    isAutoFix: true,
  },
  PYTHON_PYLINT: {
    name: "Pylint",
    language: "python",
    category: "lint",
    description: "Analyse Python source code looking for bugs",
    isSecurity: false,
    isAutoFix: false,
  },
  RUST_CLIPPY: {
    name: "Clippy",
    language: "rust",
    category: "lint",
    description: "Rust linter catching common mistakes",
    isSecurity: false,
    isAutoFix: true,
  },
};

const REPORTERS: ReporterInfo[] = [
  {
    id: "text",
    name: "Text Files",
    description: "Log files by linter with fix suggestions",
    enabled: true,
    outputFormat: "text",
  },
  {
    id: "sarif",
    name: "SARIF",
    description: "Aggregated SARIF output for IDE integration",
    enabled: false,
    outputFormat: "sarif",
  },
  {
    id: "json",
    name: "JSON Report",
    description: "Structured JSON report for programmatic access",
    enabled: false,
    outputFormat: "json",
  },
  {
    id: "markdown",
    name: "Markdown Summary",
    description: "Markdown formatted summary report",
    enabled: false,
    outputFormat: "markdown",
  },
  {
    id: "github-pr",
    name: "GitHub Pull Request Comments",
    description: "Summary comment on GitHub PRs",
    enabled: true,
    requiresCI: "github",
  },
  {
    id: "gitlab-mr",
    name: "GitLab Merge Request Comments",
    description: "Summary comment on GitLab MRs",
    enabled: true,
    requiresCI: "gitlab",
  },
  {
    id: "azure-pr",
    name: "Azure Pipelines PR Comments",
    description: "Summary comment on Azure PRs",
    enabled: true,
    requiresCI: "azure",
  },
  {
    id: "github-status",
    name: "GitHub Status Checks",
    description: "Status check per linter on GitHub",
    enabled: true,
    requiresCI: "github",
  },
  {
    id: "console",
    name: "Console Output",
    description: "Execution logs with summary table",
    enabled: true,
    outputFormat: "console",
  },
  {
    id: "tap",
    name: "TAP (Test Anything Protocol)",
    description: "TAP formatted output files",
    enabled: true,
    outputFormat: "tap",
  },
];

const server = new Server(
  {
    name: "megalinter-ox-mcp-server",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

function buildRunnerArgs(args: ToolArgs): string[] {
  const cliArgs: string[] = [];

  const pathArg = readString(args, "path");
  const flavor = readString(args, "flavor") ?? DEFAULT_FLAVOR;
  const image = readString(args, "image");
  const env = readString(args, "env");
  const release = readString(args, "release") ?? DEFAULT_RELEASE;
  const containerName = readString(args, "containerName");

  if (pathArg) {
    cliArgs.push("--path", pathArg);
  }

  cliArgs.push("--flavor", flavor);
  cliArgs.push("--release", release);

  if (image) {
    cliArgs.push("--image", image);
  }

  if (env) {
    cliArgs.push("--env", env);
  }

  if (containerName) {
    cliArgs.push("--container-name", containerName);
  }

  if (readBool(args, "fix")) {
    cliArgs.push("--fix");
  }

  if (readBool(args, "help")) {
    cliArgs.push("--help");
  }

  if (readBool(args, "install")) {
    cliArgs.push("--install");
  }

  if (readBool(args, "removeContainer")) {
    cliArgs.push("--remove-container");
  }

  const extraArgs = readStringArray(args, "extraArgs");
  if (extraArgs.length > 0) {
    cliArgs.push(...extraArgs);
  }

  return cliArgs;
}

function buildRunnerEnv(args: ToolArgs): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = {
    ...process.env,
  };

  const configFile = readString(args, "configFile");
  if (configFile) {
    env.MEGALINTER_CONFIG = configFile;
  }

  const reportsPath = readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH;
  env.MEGALINTER_REPORTS_PATH = reportsPath;

  const disableLinters = readString(args, "disableLinters");
  if (disableLinters) {
    env.DISABLE_LINTERS = disableLinters;
  }

  if (readBool(args, "lintChangedFilesOnly")) {
    env.VALIDATE_ALL_CODEBASE = "false";
  }

  return env;
}

async function runCommand(
  command: string,
  commandArgs: string[],
  cwd: string,
  env: NodeJS.ProcessEnv,
  timeoutSeconds: number,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, commandArgs, {
      cwd,
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stdout = "";
    let stderr = "";
    let timedOut = false;

    const timeout = setTimeout(() => {
      timedOut = true;
      child.kill("SIGTERM");
      setTimeout(() => child.kill("SIGKILL"), 3000);
    }, timeoutSeconds * 1000);

    child.stdout.on("data", (chunk: Buffer | string) => {
      stdout += chunk.toString();
    });

    child.stderr.on("data", (chunk: Buffer | string) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timeout);
      resolve({
        exitCode: code ?? 1,
        stdout: formatOutput(stdout),
        stderr: formatOutput(stderr),
        timedOut,
      });
    });
  });
}

async function handleRunTool(args: ToolArgs) {
  const runnerVersion = readString(args, "runnerVersion") ?? "latest";
  const npxPackage = resolveRunnerPackage(runnerVersion);
  const runnerArgs = buildRunnerArgs(args);
  const command = process.platform === "win32" ? "npx.cmd" : "npx";
  const commandArgs = [npxPackage, ...runnerArgs];
  const timeoutSeconds = Math.max(
    1,
    readNumber(args, "timeoutSeconds", DEFAULT_TIMEOUT_SECONDS),
  );

  const workingDirectory = path.resolve(
    readString(args, "workingDirectory") ?? process.cwd(),
  );

  const env = buildRunnerEnv(args);

  const result = await runCommand(
    command,
    commandArgs,
    workingDirectory,
    env,
    timeoutSeconds,
  );

  const reportsPath = env.MEGALINTER_REPORTS_PATH ?? DEFAULT_REPORTS_PATH;

  const responseText = [
    `Command: ${command} ${commandArgs.join(" ")}`,
    `Working directory: ${workingDirectory}`,
    `Reports path: ${reportsPath}`,
    `Exit code: ${result.exitCode}`,
    result.timedOut ? `Timed out after ${timeoutSeconds} seconds.` : "",
    "",
    "STDOUT:",
    result.stdout || "(empty)",
    "",
    "STDERR:",
    result.stderr || "(empty)",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return {
    content: [{ type: "text", text: responseText }],
    isError: result.exitCode !== 0 || result.timedOut,
  };
}

async function handleWriteConfigTool(args: ToolArgs) {
  const targetPath = path.resolve(
    readString(args, "targetPath") ?? ".mega-linter.yml",
  );
  const applyFixes = readString(args, "applyFixes") ?? "none";
  const showElapsedTime = readBool(args, "showElapsedTime", true);
  const flavorSuggestions = readBool(args, "flavorSuggestions", false);
  const disableLinters = readStringArray(args, "disableLinters");

  const lines: string[] = [
    "# Configuration file generated by megalinter-ox-mcp-server",
    "# See all options: https://megalinter.io/latest/configuration/",
    `APPLY_FIXES: ${applyFixes}`,
    `SHOW_ELAPSED_TIME: ${showElapsedTime ? "true" : "false"}`,
    `FLAVOR_SUGGESTIONS: ${flavorSuggestions ? "true" : "false"}`,
  ];

  if (disableLinters.length > 0) {
    lines.push("DISABLE_LINTERS:");
    for (const linter of disableLinters) {
      lines.push(`  - ${linter}`);
    }
  }

  lines.push("");

  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, lines.join("\n"), "utf8");

  return {
    content: [
      {
        type: "text",
        text: `Wrote MegaLinter configuration to ${targetPath}`,
      },
    ],
  };
}

function handleGetLintersTool(args: ToolArgs) {
  const language = readString(args, "language");
  const securityOnly = readBool(args, "securityOnly", false);
  const autoFixOnly = readBool(args, "autoFixOnly", false);

  let filtered = Object.entries(LINTER_CATALOG);

  if (language) {
    filtered = filtered.filter(([, info]) =>
      info.language.toLowerCase().includes(language.toLowerCase()),
    );
  }

  if (securityOnly) {
    filtered = filtered.filter(([, info]) => info.isSecurity);
  }

  if (autoFixOnly) {
    filtered = filtered.filter(([, info]) => info.isAutoFix);
  }

  const result = filtered.map(([id, info]) => ({
    id,
    ...info,
  }));

  return {
    content: [
      {
        type: "text",
        text: JSON.stringify(result, null, 2),
      },
    ],
  };
}

function handleGetSecurityInfoTool() {
  const securityLinters = Object.entries(LINTER_CATALOG)
    .filter(([, info]) => info.isSecurity)
    .reduce(
      (acc, [id, info]) => {
        const categories = info.securityCategories ?? [];
        for (const category of categories) {
          if (!acc[category]) {
            acc[category] = [];
          }
          acc[category].push({
            id,
            name: info.name,
            description: info.description,
            isAutoFix: info.isAutoFix,
          });
        }
        return acc;
      },
      {} as Record<string, Array<{ id: string; name: string; description: string; isAutoFix: boolean }>>,
    );

  const text =
    `# Security Linters Available in MegaLinter\n\n` +
    Object.entries(securityLinters)
      .map(([category, linters]) => {
        const categoryName = category
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
        return (
          `## ${categoryName} (${linters.length} linters)\n` +
          linters
            .map(
              (l) =>
                `- **${l.name}** (\`${l.id}\`): ${l.description}${l.isAutoFix ? " [AutoFix]" : ""}`,
            )
            .join("\n")
        );
      })
      .join("\n\n");

  return {
    content: [{ type: "text", text }],
  };
}

function handleGetReportersTool() {
  const text =
    "# Available MegaLinter Reporters\n\n" +
    REPORTERS.map(
      (r) =>
        `- **${r.name}** (\`${r.id}\`): ${r.description}\n  Status: ${r.enabled ? "Enabled" : "Disabled"}${r.requiresCI ? ` | Requires: ${r.requiresCI}` : ""}`,
    ).join("\n");

  return {
    content: [{ type: "text", text }],
  };
}

async function handleParseReportsTool(args: ToolArgs) {
  const reportsPath = readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH;
  const reportType = readString(args, "reportType") ?? "json";

  try {
    const reportFile = path.join(reportsPath, `megalinter-report.${reportType}`);
    const { readFile } = await import("node:fs/promises");

    let report: unknown;
    const fileContent = await readFile(reportFile, "utf-8");

    if (reportType === "json") {
      report = JSON.parse(fileContent);
    } else if (reportType === "sarif") {
      report = JSON.parse(fileContent);
    } else {
      return {
        content: [
          {
            type: "text",
            text: `Unsupported report type: ${reportType}. Supported types: json, sarif`,
          },
        ],
        isError: true,
      };
    }

    const summary = JSON.stringify(report, null, 2);
    return {
      content: [
        {
          type: "text",
          text: `# Parsed ${reportType.toUpperCase()} Report\n\n\`\`\`json\n${summary}\n\`\`\``,
        },
      ],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error parsing reports: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleGetIssueSummaryTool(args: ToolArgs) {
  const reportsPath = readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH;
  const severityFilter = readString(args, "severityFilter");
  const linterFilter = readString(args, "linterFilter");

  try {
    const reportFile = path.join(reportsPath, "megalinter-report.json");
    const { readFile } = await import("node:fs/promises");

    const fileContent = await readFile(reportFile, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const report = JSON.parse(fileContent) as ReportMetadata;

    const summary: IssueSummary = {
      totalIssues: report.summary?.total_badges_errors ?? 0,
      bySeverity: {},
      byLinter: {},
      byCategory: {},
      criticalSecurity: [],
      topIssues: [],
    };

    // Aggregate linter statistics
    if (Array.isArray(report.linter_runs)) {
      for (const run of report.linter_runs) {
        if (run.linter_name) {
          summary.byLinter[run.linter_name] =
            (summary.byLinter[run.linter_name] ?? 0) + 1;
        }
      }
    }

    let responseText = "# Issue Summary Report\n\n";
    responseText += `**Total Issues**: ${summary.totalIssues}\n\n`;
    responseText += "## By Linter (Runs)\n";
    responseText +=
      Object.entries(summary.byLinter)
        .map(([linter, count]) => `- ${linter}: ${count} runs`)
        .join("\n") || "No linter data available";

    if (severityFilter || linterFilter) {
      responseText += "\n\n**Filters Applied**:\n";
      if (severityFilter) responseText += `- Severity: ${severityFilter}\n`;
      if (linterFilter) responseText += `- Linter: ${linterFilter}\n`;
    }

    return {
      content: [{ type: "text", text: responseText }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error analyzing issues: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

async function handleGetSecurityRecommendationsTool(args: ToolArgs) {
  const reportsPath = readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH;

  try {
    const reportFile = path.join(reportsPath, "megalinter-report.json");
    const { readFile } = await import("node:fs/promises");

    const fileContent = await readFile(reportFile, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const report = JSON.parse(fileContent) as ReportMetadata;

    let responseText = "# Security-Focused Recommendations\n\n";

    // Identify security linters
    const securityLinters = report.linter_runs?.filter((run) => {
      const name = run.linter_name?.toLowerCase() ?? "";
      return (
        name.includes("semgrep") ||
        name.includes("bandit") ||
        name.includes("gitleaks") ||
        name.includes("devskim") ||
        name.includes("trivy") ||
        name.includes("hadolint") ||
        name.includes("checkov") ||
        name.includes("tfsec")
      );
    }) ?? [];

    if (securityLinters.length > 0) {
      responseText += "## Active Security Linters\n";
      responseText +=
        securityLinters.map((run) => `- ${run.linter_name}`).join("\n") +
        "\n\n";
    }

    responseText += "## Recommended Security Practices\n\n";
    responseText += "1. **SAST (Static Application Security Testing)**\n";
    responseText +=
      "   - Use Semgrep for comprehensive multi-language pattern detection\n";
    responseText +=
      "   - Use Bandit for Python-specific security analysis\n";
    responseText += "   - Use DevSkim for general code security patterns\n\n";

    responseText += "2. **Secrets Detection**\n";
    responseText += "   - Enable Gitleaks to prevent credential leaks\n";
    responseText +=
      "   - Configure pre-commit hooks to validate before push\n\n";

    responseText += "3. **Container & Infrastructure Security**\n";
    responseText += "   - Use Hadolint for Dockerfile security\n";
    responseText +=
      "   - Use Trivy for container image vulnerability scanning\n";
    responseText +=
      "   - Use Checkov or Tfsec for Infrastructure as Code security\n\n";

    responseText += "4. **Supply Chain Security**\n";
    responseText +=
      "   - Verify dependency versions with npm audit or similar tools\n";
    responseText += "   - Review security advisories regularly\n\n";

    responseText += "## Next Steps\n";
    responseText += "1. Review flagged security issues in priority order\n";
    responseText += "2. Configure auto-fix linters where available\n";
    responseText +=
      "3. Integrate security scanning into CI/CD pipeline\n";
    responseText +=
      "4. Enable PR comments to catch issues during review\n";

    return {
      content: [{ type: "text", text: responseText }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error generating recommendations: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "megalinter_run",
        description:
          "Run Ox Security MegaLinter using mega-linter-runner. Works locally or in any CI/CD environment.",
        inputSchema: {
          type: "object",
          properties: {
            workingDirectory: {
              type: "string",
              description:
                "Directory where the command is executed. Defaults to current process directory.",
            },
            path: {
              type: "string",
              description: "Directory path to lint.",
            },
            flavor: {
              type: "string",
              description: "MegaLinter flavor.",
              default: DEFAULT_FLAVOR,
            },
            release: {
              type: "string",
              description: "MegaLinter Docker image tag.",
              default: DEFAULT_RELEASE,
            },
            image: {
              type: "string",
              description: "Optional full Docker image override.",
            },
            env: {
              type: "string",
              description:
                "Environment variable string passed to --env (for example: DISABLE_LINTERS=SPELL_CSPELL,MARKDOWN_MARKDOWNLINT).",
            },
            fix: {
              type: "boolean",
              description: "Apply auto-fixes.",
              default: false,
            },
            help: {
              type: "boolean",
              description: "Show mega-linter-runner help.",
              default: false,
            },
            install: {
              type: "boolean",
              description: "Generate MegaLinter starter config files.",
              default: false,
            },
            containerName: {
              type: "string",
              description: "Optional Docker container name.",
            },
            removeContainer: {
              type: "boolean",
              description: "Remove container after completion.",
              default: false,
            },
            configFile: {
              type: "string",
              description: "Path to .mega-linter.yml file.",
            },
            reportsPath: {
              type: "string",
              description: "Directory where reports are written.",
              default: DEFAULT_REPORTS_PATH,
            },
            disableLinters: {
              type: "string",
              description: "Comma-separated list of linters to disable.",
            },
            lintChangedFilesOnly: {
              type: "boolean",
              description:
                "If true, sets VALIDATE_ALL_CODEBASE=false to lint only changed files.",
              default: false,
            },
            runnerVersion: {
              type: "string",
              description:
                "mega-linter-runner npm version. Use 'latest' or a specific version.",
              default: "latest",
            },
            timeoutSeconds: {
              type: "number",
              description: "Command timeout in seconds.",
              default: DEFAULT_TIMEOUT_SECONDS,
            },
            extraArgs: {
              type: "array",
              description: "Additional CLI arguments to append.",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_write_config",
        description: "Generate a minimal .mega-linter.yml configuration file.",
        inputSchema: {
          type: "object",
          properties: {
            targetPath: {
              type: "string",
              description:
                "Output path for the MegaLinter config file. Defaults to .mega-linter.yml",
            },
            applyFixes: {
              type: "string",
              description: "Value for APPLY_FIXES (none, all, or linter list).",
              default: "none",
            },
            showElapsedTime: {
              type: "boolean",
              description: "Set SHOW_ELAPSED_TIME.",
              default: true,
            },
            flavorSuggestions: {
              type: "boolean",
              description: "Set FLAVOR_SUGGESTIONS.",
              default: false,
            },
            disableLinters: {
              type: "array",
              description: "Optional list for DISABLE_LINTERS.",
              items: { type: "string" },
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_list_flavors",
        description: "List commonly used MegaLinter flavors.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_get_linters",
        description:
          "Discover available linters by language, security category, or auto-fix capability.",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              description:
                "Filter by programming language (e.g., python, javascript, terraform).",
            },
            securityOnly: {
              type: "boolean",
              description: "Return only security-focused linters.",
              default: false,
            },
            autoFixOnly: {
              type: "boolean",
              description: "Return only linters that support automatic fixes.",
              default: false,
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_get_security_info",
        description:
          "Get comprehensive information about security-focused linters organized by category (SAST, secrets, supply-chain, container, infrastructure).",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_get_reporters",
        description: "List all available MegaLinter reporters and their configuration options.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_parse_reports",
        description:
          "Parse MegaLinter JSON or SARIF reports from the reports directory. Returns structured report data for analysis.",
        inputSchema: {
          type: "object",
          properties: {
            reportsPath: {
              type: "string",
              description:
                "Path to the reports directory. Defaults to megalinter-reports.",
            },
            reportType: {
              type: "string",
              enum: ["json", "sarif"],
              description:
                "Type of report to parse. Defaults to json.",
              default: "json",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_get_issue_summary",
        description:
          "Analyze and summarize issues from MegaLinter reports by severity, linter, and category. Enables filtering and targeted remediation.",
        inputSchema: {
          type: "object",
          properties: {
            reportsPath: {
              type: "string",
              description:
                "Path to the reports directory. Defaults to megalinter-reports.",
            },
            severityFilter: {
              type: "string",
              enum: ["error", "warning", "info"],
              description:
                "Filter issues by severity level.",
            },
            linterFilter: {
              type: "string",
              description:
                "Filter issues by specific linter name.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_get_security_recommendations",
        description:
          "Generate security-focused recommendations based on active linters and common threat categories (SAST, secrets, container, infrastructure).",
        inputSchema: {
          type: "object",
          properties: {
            reportsPath: {
              type: "string",
              description:
                "Path to the reports directory. Defaults to megalinter-reports.",
            },
          },
          additionalProperties: false,
        },
      },
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const args = (request.params.arguments ?? {}) as ToolArgs;

  if (request.params.name === "megalinter_run") {
    return handleRunTool(args);
  }

  if (request.params.name === "megalinter_write_config") {
    return handleWriteConfigTool(args);
  }

  if (request.params.name === "megalinter_list_flavors") {
    return {
      content: [
        {
          type: "text",
          text: KNOWN_FLAVORS.join(", "),
        },
      ],
    };
  }

  if (request.params.name === "megalinter_get_linters") {
    return handleGetLintersTool(args);
  }

  if (request.params.name === "megalinter_get_security_info") {
    return handleGetSecurityInfoTool();
  }

  if (request.params.name === "megalinter_get_reporters") {
    return handleGetReportersTool();
  }

  if (request.params.name === "megalinter_parse_reports") {
    return handleParseReportsTool(args);
  }

  if (request.params.name === "megalinter_get_issue_summary") {
    return handleGetIssueSummaryTool(args);
  }

  if (request.params.name === "megalinter_get_security_recommendations") {
    return handleGetSecurityRecommendationsTool(args);
  }

  return {
    content: [
      {
        type: "text",
        text: `Unknown tool: ${request.params.name}`,
      },
    ],
    isError: true,
  };
});

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error) => {
  console.error("Fatal MCP server error:", error);
  process.exit(1);
});
