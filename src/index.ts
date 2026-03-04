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

server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "megalinter_run",
        description:
          "Run Ox Security MegaLinter using mega-linter-runner with Azure DevOps extension style inputs.",
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