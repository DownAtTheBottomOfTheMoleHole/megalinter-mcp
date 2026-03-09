#!/usr/bin/env node
import { spawn } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { pathToFileURL } from "node:url";
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
const DEFAULT_QUICK_TIMEOUT_MINUTES = 20;

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
  securityCategories?: (
    | "sast"
    | "secrets"
    | "supply-chain"
    | "container"
    | "infrastructure"
  )[];
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

type QuickIntent =
  | "run"
  | "write_config"
  | "list_flavors"
  | "list_linters"
  | "security_info"
  | "list_reporters"
  | "parse_reports"
  | "issue_summary"
  | "security_recommendations";

type QuickRunPreset = "quick" | "full" | "security" | "fix";

type QuickAction =
  | "scan"
  | "config"
  | "flavors"
  | "linters"
  | "security"
  | "reporters"
  | "parse"
  | "summary"
  | "recommendations";

// Comprehensive linter metadata from MegaLinter documentation
const LINTER_CATALOG: Record<string, LinterInfo> = {
  // SAST Linters
  REPOSITORY_SEMGREP: {
    name: "Semgrep",
    language: "multi",
    category: "security",
    description:
      "Static analysis engine for finding bugs, security issues, and antipatterns",
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

const LINTER_LANGUAGE_HINTS = [
  "ansible",
  "cloudformation",
  "dockerfile",
  "go",
  "infrastructure",
  "java",
  "javascript",
  "kubernetes",
  "php",
  "python",
  "repository",
  "rust",
  "terraform",
  "typescript",
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

function summariseOutput(output: string, maxLines: number): string {
  if (!output) {
    return "(empty)";
  }

  const lines = output.split(/\r?\n/);
  if (lines.length <= maxLines) {
    return output;
  }

  const headCount = Math.max(1, Math.floor(maxLines * 0.7));
  const tailCount = Math.max(1, maxLines - headCount);
  const head = lines.slice(0, headCount).join("\n");
  const tail = lines.slice(-tailCount).join("\n");

  return `${head}\n\n... output truncated for summary mode ...\n\n${tail}`;
}

function normaliseText(value: string | undefined): string {
  return (value ?? "").trim().toLowerCase();
}

function includesAny(text: string, tokens: string[]): boolean {
  return tokens.some((token) => text.includes(token));
}

function getQuickIntentFromAction(
  action: QuickAction | undefined,
): QuickIntent | undefined {
  if (!action) {
    return undefined;
  }

  if (action === "scan") {
    return "run";
  }

  if (action === "config") {
    return "write_config";
  }

  if (action === "flavors") {
    return "list_flavors";
  }

  if (action === "linters") {
    return "list_linters";
  }

  if (action === "security") {
    return "security_info";
  }

  if (action === "reporters") {
    return "list_reporters";
  }

  if (action === "parse") {
    return "parse_reports";
  }

  if (action === "summary") {
    return "issue_summary";
  }

  if (action === "recommendations") {
    return "security_recommendations";
  }

  return undefined;
}

function getQuickRunPresetFromScanMode(
  scanMode: QuickRunPreset | undefined,
): QuickRunPreset | undefined {
  return scanMode;
}

function getEnumString<T extends string>(
  args: ToolArgs,
  key: string,
  allowed: readonly T[],
): T | undefined {
  const value = readString(args, key);
  if (!value) {
    return undefined;
  }

  const normalised = value.toLowerCase();
  return (allowed as readonly string[]).includes(normalised)
    ? (normalised as T)
    : undefined;
}

function getQuickIntent(request: string): QuickIntent {
  if (includesAny(request, ["flavor", "flavour"])) {
    return "list_flavors";
  }

  if (includesAny(request, ["reporter"])) {
    return "list_reporters";
  }

  if (
    includesAny(request, [
      "security info",
      "security categories",
      "security category",
      "threat category",
    ])
  ) {
    return "security_info";
  }

  if (includesAny(request, ["recommend", "remediation"])) {
    return "security_recommendations";
  }

  if (
    includesAny(request, ["summary", "summarise", "summarize", "triage"])
  ) {
    return "issue_summary";
  }

  if (
    includesAny(request, ["parse", "sarif", "json report", "read report"])
  ) {
    return "parse_reports";
  }

  if (includesAny(request, ["linter", "linters"])) {
    return "list_linters";
  }

  if (includesAny(request, ["config", ".mega-linter.yml", "configuration"])) {
    return "write_config";
  }

  return "run";
}

function getQuickRunPreset(request: string): QuickRunPreset {
  if (includesAny(request, ["security", "secure", "sast", "secrets"])) {
    return "security";
  }

  if (includesAny(request, ["fix", "auto-fix", "autofix"])) {
    return "fix";
  }

  if (includesAny(request, ["full", "all files", "complete"])) {
    return "full";
  }

  return "quick";
}

function getLanguageFromText(request: string): string | undefined {
  const orderedLanguages = [...LINTER_LANGUAGE_HINTS].sort(
    (left, right) => right.length - left.length,
  );

  for (const language of orderedLanguages) {
    const escaped = language.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const tokenPattern = new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`);
    if (tokenPattern.test(request)) {
      return language;
    }
  }

  return undefined;
}

function getSeverityFromText(
  request: string,
): "error" | "warning" | "info" | undefined {
  if (request.includes("error")) {
    return "error";
  }

  if (request.includes("warning")) {
    return "warning";
  }

  if (request.includes("info")) {
    return "info";
  }

  return undefined;
}

/**
 * Detect languages and frameworks present in the current repository by inspecting common files.
 */
async function detectProjectContext(): Promise<{
  languages: string[];
  frameworks: string[];
  hasDocker: boolean;
  hasTerraform: boolean;
  hasSecurity: boolean;
}> {
  const { readFile } = await import("node:fs/promises");
  const { existsSync } = await import("node:fs");

  const languages: string[] = [];
  const frameworks: string[] = [];
  let hasDocker = false;
  let hasTerraform = false;
  let hasSecurity = false;

  // Detect languages via package managers and config files
  if (existsSync("package.json")) {
    languages.push("javascript");
    try {
      const pkg = JSON.parse(await readFile("package.json", "utf-8")) as {
        dependencies?: Record<string, string>;
        devDependencies?: Record<string, string>;
      };
      const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
      };
      if (allDeps.typescript) {
        languages.push("typescript");
      }
      if (allDeps.react) {
        frameworks.push("React");
      }
      if (allDeps.vue) {
        frameworks.push("Vue");
      }
      if (allDeps.angular) {
        frameworks.push("Angular");
      }
    } catch {
      /* ignore parse errors */
    }
  }

  if (existsSync("requirements.txt") || existsSync("setup.py") || existsSync("pyproject.toml")) {
    languages.push("python");
  }

  if (existsSync("Cargo.toml")) {
    languages.push("rust");
  }

  if (existsSync("go.mod")) {
    languages.push("go");
  }

  if (existsSync("Gemfile")) {
    languages.push("ruby");
  }

  if (existsSync("composer.json")) {
    languages.push("php");
  }

  if (existsSync("pom.xml") || existsSync("build.gradle")) {
    languages.push("java");
  }

  // Detect infrastructure
  if (existsSync("Dockerfile") || existsSync("docker-compose.yml")) {
    hasDocker = true;
  }

  if (existsSync("main.tf") || existsSync("terraform.tf")) {
    hasTerraform = true;
  }

  // Detect security concerns
  if (existsSync(".env") || existsSync(".env.example")) {
    hasSecurity = true;
  }

  return {
    languages: [...new Set(languages)],
    frameworks,
    hasDocker,
    hasTerraform,
    hasSecurity,
  };
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
  const summaryOnly = readBool(args, "summaryOnly", false);

  const stdout = summaryOnly ? summariseOutput(result.stdout, 60) : result.stdout;
  const stderr = summaryOnly ? summariseOutput(result.stderr, 60) : result.stderr;

  const responseText = [
    `Command: ${command} ${commandArgs.join(" ")}`,
    `Working directory: ${workingDirectory}`,
    `Reports path: ${reportsPath}`,
    `Exit code: ${result.exitCode}`,
    result.timedOut ? `Timed out after ${timeoutSeconds} seconds.` : "",
    summaryOnly
      ? "Output mode: summary (set summaryOnly=false for full logs)."
      : "",
    "",
    "STDOUT:",
    stdout || "(empty)",
    "",
    "STDERR:",
    stderr || "(empty)",
  ]
    .filter((line) => line.length > 0)
    .join("\n");

  return {
    content: [{ type: "text", text: responseText }],
    isError: result.exitCode !== 0 || result.timedOut,
  };
}

export async function handleQuickActionTool(args: ToolArgs) {
  const action = getEnumString<QuickAction>(args, "action", [
    "scan",
    "config",
    "flavors",
    "linters",
    "security",
    "reporters",
    "parse",
    "summary",
    "recommendations",
  ]);
  const request = normaliseText(readString(args, "request") ?? "quick scan");
  const intent = getQuickIntentFromAction(action) ?? getQuickIntent(request);

  if (intent === "list_flavors") {
    return {
      content: [{ type: "text", text: KNOWN_FLAVORS.join(", ") }],
    };
  }

  if (intent === "list_reporters") {
    return handleGetReportersTool();
  }

  if (intent === "security_info") {
    return handleGetSecurityInfoTool();
  }

  if (intent === "security_recommendations") {
    return handleGetSecurityRecommendationsTool({
      reportsPath: readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH,
    });
  }

  if (intent === "issue_summary") {
    const severity =
      getEnumString<"error" | "warning" | "info">(args, "severity", [
        "error",
        "warning",
        "info",
      ]) ?? getSeverityFromText(request);
    return handleGetIssueSummaryTool({
      reportsPath: readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH,
      severityFilter: severity,
    });
  }

  if (intent === "parse_reports") {
    const reportType =
      getEnumString<"json" | "sarif">(args, "reportType", [
        "json",
        "sarif",
      ]) ?? (request.includes("sarif") ? "sarif" : "json");
    return handleParseReportsTool({
      reportsPath: readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH,
      reportType,
    });
  }

  if (intent === "list_linters") {
    const language = readString(args, "language") ?? getLanguageFromText(request);
    const securityOnly = readBool(
      args,
      "securityOnly",
      includesAny(request, ["security", "secure", "sast", "secret"]),
    );
    const autoFixOnly = readBool(
      args,
      "autoFixOnly",
      includesAny(request, ["autofix", "auto-fix", "fix"]),
    );
    return handleGetLintersTool({ language, securityOnly, autoFixOnly });
  }

  if (intent === "write_config") {
    const applyFixes = includesAny(request, ["autofix", "auto-fix", "fix"])
      ? "all"
      : "none";
    return handleWriteConfigTool({
      targetPath: readString(args, "targetPath") ?? ".mega-linter.yml",
      applyFixes,
      showElapsedTime: true,
      flavorSuggestions: false,
    });
  }

  const scanMode = getEnumString<QuickRunPreset>(args, "scanMode", [
    "quick",
    "full",
    "security",
    "fix",
  ]);
  const preset =
    getQuickRunPresetFromScanMode(scanMode) ?? getQuickRunPreset(request);
  const timeoutMinutes = Math.max(
    1,
    readNumber(
      args,
      "timeoutMinutes",
      preset === "full" ? 60 : DEFAULT_QUICK_TIMEOUT_MINUTES,
    ),
  );

  const runArgs: ToolArgs = {
    workingDirectory: readString(args, "workingDirectory"),
    path: readString(args, "target") ?? ".",
    reportsPath: readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH,
    timeoutSeconds: timeoutMinutes * 60,
    summaryOnly: readBool(args, "summaryOnly", true),
  };

  if (preset === "quick") {
    runArgs.flavor = "ci_light";
    runArgs.lintChangedFilesOnly = true;
  }

  if (preset === "full") {
    runArgs.flavor = "all";
  }

  if (preset === "security") {
    runArgs.flavor = "security";
  }

  if (preset === "fix") {
    runArgs.flavor = "ci_light";
    runArgs.fix = true;
    runArgs.lintChangedFilesOnly = true;
  }

  const explicitFlavor = readString(args, "flavor");
  if (explicitFlavor) {
    runArgs.flavor = explicitFlavor;
  }

  if (readBool(args, "fix")) {
    runArgs.fix = true;
  }

  return handleRunTool(runArgs);
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

export function handleGetLintersTool(args: ToolArgs) {
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
      {} as Record<
        string,
        Array<{
          id: string;
          name: string;
          description: string;
          isAutoFix: boolean;
        }>
      >,
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

export async function handleParseReportsTool(args: ToolArgs) {
  const reportsPath = readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH;
  const reportType = readString(args, "reportType") ?? "json";

  if (reportType !== "json" && reportType !== "sarif") {
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

  try {
    const reportFile = path.join(
      reportsPath,
      `megalinter-report.${reportType}`,
    );
    const { readFile } = await import("node:fs/promises");

    const fileContent = await readFile(reportFile, "utf-8");
    const report: unknown = JSON.parse(fileContent);

    const summary = JSON.stringify(report, null, 2);
    return {
      content: [
        {
          type: "text",
          text: `# Parsed ${reportType.toUpperCase()} Report\n\n\`\`\`${reportType}\n${summary}\n\`\`\``,
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

export async function handleGetIssueSummaryTool(args: ToolArgs) {
  const reportsPath = readString(args, "reportsPath") ?? DEFAULT_REPORTS_PATH;
  const severityFilter = readString(args, "severityFilter");
  const linterFilter = readString(args, "linterFilter");

  try {
    const reportFile = path.join(reportsPath, "megalinter-report.json");
    const { readFile } = await import("node:fs/promises");

    const fileContent = await readFile(reportFile, "utf-8");
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const report = JSON.parse(fileContent) as ReportMetadata;

    const totalErrors = report.summary?.total_badges_errors ?? 0;
    const totalWarnings = report.summary?.total_badges_warnings ?? 0;

    let filteredTotalIssues = totalErrors + totalWarnings;
    if (severityFilter === "error") {
      filteredTotalIssues = totalErrors;
    } else if (severityFilter === "warning") {
      filteredTotalIssues = totalWarnings;
    } else if (severityFilter === "info") {
      filteredTotalIssues = 0;
    }

    const summary: IssueSummary = {
      totalIssues: filteredTotalIssues,
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

    const allLinterEntries = Object.entries(summary.byLinter);
    const filteredLinterEntries = linterFilter
      ? allLinterEntries.filter(([linterName]) =>
          linterName.toLowerCase().includes(linterFilter.toLowerCase()),
        )
      : allLinterEntries;

    let responseText = "# Issue Summary Report\n\n";
    responseText += `**Total Issues**: ${summary.totalIssues}\n\n`;
    responseText += "## By Linter (Runs)\n";
    if (filteredLinterEntries.length > 0) {
      responseText += filteredLinterEntries
        .map(([linter, count]) => `- ${linter}: ${count} runs`)
        .join("\n");
    } else {
      responseText += linterFilter
        ? "No linter data available for the selected filters"
        : "No linter data available";
    }

    if (severityFilter || linterFilter) {
      responseText += "\n\n**Filters Applied**:\n";
      if (severityFilter) {
        responseText +=
          `- Severity: ${severityFilter} (applies to total issue count)\n`;
      }
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
          text: `Error analysing issues: ${errorMessage}`,
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

    // Build security linter identifiers from LINTER_CATALOG so detection
    // stays in sync with the catalog as new linters are added.
    const catalogSecurityNames = new Set(
      Object.entries(LINTER_CATALOG)
        .filter(([, info]) => info.isSecurity)
        .flatMap(([id, info]) => [id.toLowerCase(), info.name.toLowerCase()]),
    );
    // Pre-convert to array once to avoid repeated Set-to-array conversion inside the filter.
    const catalogSecurityNamesArray = [...catalogSecurityNames];

    // Identify security linters active in the report using catalog-derived identifiers
    const securityLinters =
      report.linter_runs?.filter((run) => {
        const name = run.linter_name?.toLowerCase() ?? "";
        return (
          catalogSecurityNames.has(name) ||
          catalogSecurityNamesArray.some((identifier) =>
            name.includes(identifier),
          )
        );
      }) ?? [];

    if (securityLinters.length > 0) {
      responseText += "## Active Security Linters\n";
      responseText +=
        securityLinters.map((run) => `- ${run.linter_name}`).join("\n") +
        "\n\n";
    }

    // Build recommendations from LINTER_CATALOG grouped by security category
    // so this section automatically reflects the full catalog.
    const catalogByCategory = Object.entries(LINTER_CATALOG)
      .filter(([, info]) => info.isSecurity)
      .reduce(
        (acc, [, info]) => {
          for (const cat of info.securityCategories ?? []) {
            if (!acc[cat]) acc[cat] = [];
            acc[cat].push(info);
          }
          return acc;
        },
        {} as Record<string, LinterInfo[]>,
      );

    const categoryLabels: Record<string, string> = {
      sast: "SAST (Static Application Security Testing)",
      secrets: "Secrets Detection",
      container: "Container Security",
      infrastructure: "Infrastructure Security",
      "supply-chain": "Supply Chain Security",
    };

    responseText += "## Recommended Security Practices\n\n";
    let sectionNum = 1;
    for (const [cat, linters] of Object.entries(catalogByCategory)) {
      // Fall back to a title-cased rendering for any category not in the label map.
      const label =
        categoryLabels[cat] ??
        cat
          .split("-")
          .map((w) => w[0].toUpperCase() + w.slice(1))
          .join(" ");
      responseText += `${sectionNum}. **${label}**\n`;
      for (const linter of linters) {
        responseText += `   - ${linter.name}: ${linter.description}${linter.isAutoFix ? " [AutoFix]" : ""}\n`;
      }
      responseText += "\n";
      sectionNum++;
    }

    responseText += "## Next Steps\n";
    responseText += "1. Review flagged security issues in priority order\n";
    responseText += "2. Configure auto-fix linters where available\n";
    responseText += "3. Integrate security scanning into CI/CD pipeline\n";
    responseText += "4. Enable PR comments to catch issues during review\n";

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

/**
 * Context-aware help tool that provides suggestions based on the current repository.
 */
export async function handleHelpQuickTool() {
  try {
    const context = await detectProjectContext();

    let responseText = "# MegaLinter Quick Help\n\n";
    responseText += "Based on your project, here are suggested commands:\n\n";

    // Language-specific suggestions
    if (context.languages.length > 0) {
      responseText += `## Detected Languages: ${context.languages.join(", ")}\n\n`;
      responseText += "**Shorthand examples:**\n";
      for (const lang of context.languages.slice(0, 2)) {
        responseText += `- \`list ${lang} linters\`\n`;
        responseText += `- \`quick ${lang} scan\`\n`;
      }
      responseText += "\n**Explicit examples:**\n";
      responseText += "```json\n";
      responseText += `{ "action": "scan", "language": "${context.languages[0]}", "scanMode": "quick" }\n`;
      responseText += "```\n\n";
    }

    // Security suggestions
    if (context.hasSecurity) {
      responseText += "## Security Recommendations\n\n";
      responseText += "Your project has `.env` files. Consider:\n";
      responseText += "- **Shorthand:** `security scan`\n";
      responseText += "- **Explicit:** `{ \"action\": \"scan\", \"securityOnly\": true }`\n\n";
    }

    // Infrastructure suggestions
    if (context.hasDocker) {
      responseText += "## Docker detected\n\n";
      responseText += "Run Dockerfile linters:\n";
      responseText += "- **Shorthand:** `scan docker`\n";
      responseText += "- **Explicit:** `{ \"action\": \"scan\", \"language\": \"docker\" }`\n\n";
    }

    if (context.hasTerraform) {
      responseText += "## Terraform detected\n\n";
      responseText += "Validate IaC:\n";
      responseText += "- **Shorthand:** `terraform security scan`\n";
      responseText += "- **Explicit:** `{ \"action\": \"scan\", \"language\": \"terraform\", \"securityOnly\": true }`\n\n";
    }

    // Generic examples
    responseText += "## Common Commands\n\n";
    responseText += "### Ultra-short aliases\n";
    responseText += "- `scan` — Run a quick scan\n";
    responseText += "- `summary` — Summarise errors from last run\n";
    responseText += "- `parse` — Parse JSON report\n\n";

    responseText += "### Quick Actions (shorthand)\n";
    responseText += "- `quick scan`\n";
    responseText += "- `full scan`\n";
    responseText += "- `security scan`\n";
    responseText += "- `summarise errors`\n";
    responseText += "- `list python linters`\n\n";

    responseText += "### Quick Actions (explicit)\n";
    responseText += "- `{ \"action\": \"scan\", \"scanMode\": \"quick\" }`\n";
    responseText += "- `{ \"action\": \"summary\", \"severity\": \"error\" }`\n";
    responseText += "- `{ \"action\": \"parse\", \"reportType\": \"sarif\" }`\n";

    return {
      content: [{ type: "text", text: responseText }],
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return {
      content: [
        {
          type: "text",
          text: `Error generating help: ${errorMessage}`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Ultra-short alias: scan
 */
export async function handleScanAlias(args: ToolArgs) {
  return handleQuickActionTool({ ...args, action: "scan" });
}

/**
 * Ultra-short alias: summary
 */
export async function handleSummaryAlias(args: ToolArgs) {
  return handleQuickActionTool({ ...args, action: "summary" });
}

/**
 * Ultra-short alias: parse
 */
export async function handleParseAlias(args: ToolArgs) {
  return handleQuickActionTool({ ...args, action: "parse" });
}

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "megalinter_quick_action",
        description:
          "Interactive shortcut tool for short requests (for example: quick scan, security scan, summarise errors, list python security linters).",
        inputSchema: {
          type: "object",
          properties: {
            request: {
              type: "string",
              description:
                "Short instruction. Examples: quick scan, full scan, security scan, summarise errors, parse sarif report, write config.",
              default: "quick scan",
            },
            action: {
              type: "string",
              enum: [
                "scan",
                "config",
                "flavors",
                "linters",
                "security",
                "reporters",
                "parse",
                "summary",
                "recommendations",
              ],
              description:
                "Optional explicit action. Use this for deterministic quick workflows.",
            },
            scanMode: {
              type: "string",
              enum: ["quick", "full", "security", "fix"],
              description:
                "Scan preset when action is scan (or request implies a scan).",
            },
            target: {
              type: "string",
              description: "Directory to scan for run requests. Defaults to .",
            },
            workingDirectory: {
              type: "string",
              description:
                "Directory where commands run. Defaults to current process directory.",
            },
            reportsPath: {
              type: "string",
              description:
                "Report directory for parse, summary, and recommendation requests.",
              default: DEFAULT_REPORTS_PATH,
            },
            reportType: {
              type: "string",
              enum: ["json", "sarif"],
              description:
                "Report format for parse requests. Defaults to json unless sarif is requested.",
            },
            severity: {
              type: "string",
              enum: ["error", "warning", "info"],
              description: "Severity filter for summary requests.",
            },
            language: {
              type: "string",
              description: "Language filter for linter-list requests.",
            },
            securityOnly: {
              type: "boolean",
              description: "Filter linter-list requests to security linters.",
              default: false,
            },
            autoFixOnly: {
              type: "boolean",
              description: "Filter linter-list requests to auto-fix linters.",
              default: false,
            },
            timeoutMinutes: {
              type: "number",
              description: "Run timeout in minutes for scan requests.",
              default: DEFAULT_QUICK_TIMEOUT_MINUTES,
            },
            summaryOnly: {
              type: "boolean",
              description:
                "Use concise output for scan requests. Set false for full logs.",
              default: true,
            },
            flavor: {
              type: "string",
              description:
                "Optional flavour override for scan requests (e.g., javascript, python, security).",
            },
            fix: {
              type: "boolean",
              description: "Force auto-fix for scan requests.",
              default: false,
            },
            targetPath: {
              type: "string",
              description:
                "Output file path for write-config requests. Defaults to .mega-linter.yml.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "megalinter_run",
        description:
          "Run Ox Security MegaLinter using mega-linter-runner with full low-level control. For short prompts, use megalinter_quick_action.",
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
            summaryOnly: {
              type: "boolean",
              description: "Return concise logs instead of full stdout/stderr output.",
              default: false,
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
        description:
          "List all available MegaLinter reporters and their configuration options.",
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
              description: "Type of report to parse. Defaults to json.",
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
              description: "Filter issues by severity level.",
            },
            linterFilter: {
              type: "string",
              description: "Filter issues by specific linter name.",
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
      {
        name: "megalinter_help_quick",
        description:
          "Get context-aware help and examples based on your current repository. Suggests relevant commands for detected languages and frameworks.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
      },
      {
        name: "scan",
        description:
          "Ultra-short alias for quick scan. Same as megalinter_quick_action with action='scan'.",
        inputSchema: {
          type: "object",
          properties: {
            language: {
              type: "string",
              description: "Target language (e.g., python, javascript).",
            },
            scanMode: {
              type: "string",
              enum: ["quick", "full", "security", "fix"],
              description: "Scan preset mode.",
              default: "quick",
            },
            summaryOnly: {
              type: "boolean",
              description: "Return concise output.",
              default: true,
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "summary",
        description:
          "Ultra-short alias for error summary. Same as megalinter_quick_action with action='summary'.",
        inputSchema: {
          type: "object",
          properties: {
            severity: {
              type: "string",
              enum: ["error", "warning", "info"],
              description: "Filter by severity level.",
            },
            linter: {
              type: "string",
              description: "Filter by linter name.",
            },
          },
          additionalProperties: false,
        },
      },
      {
        name: "parse",
        description:
          "Ultra-short alias for report parsing. Same as megalinter_quick_action with action='parse'.",
        inputSchema: {
          type: "object",
          properties: {
            reportType: {
              type: "string",
              enum: ["json", "sarif"],
              description: "Type of report to parse.",
              default: "json",
            },
            reportsPath: {
              type: "string",
              description: "Reports directory path.",
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

  if (request.params.name === "megalinter_quick_action") {
    return handleQuickActionTool(args);
  }

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

  if (request.params.name === "megalinter_help_quick") {
    return handleHelpQuickTool();
  }

  if (request.params.name === "scan") {
    return handleScanAlias(args);
  }

  if (request.params.name === "summary") {
    return handleSummaryAlias(args);
  }

  if (request.params.name === "parse") {
    return handleParseAlias(args);
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

const isMainModule =
  typeof process.argv[1] === "string" &&
  pathToFileURL(path.resolve(process.argv[1])).href === import.meta.url;

if (isMainModule) {
  main().catch((error) => {
    console.error("Fatal MCP server error:", error);
    process.exit(1);
  });
}
