export type ToolArgs = Record<string, unknown>;

export function readString(args: ToolArgs, key: string): string | undefined {
  const value = args[key];
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function readBool(
  args: ToolArgs,
  key: string,
  defaultValue = false,
): boolean {
  const value = args[key];
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "y"].includes(normalized)) {
      return true;
    }

    if (["false", "0", "no", "n"].includes(normalized)) {
      return false;
    }
  }

  return defaultValue;
}

export function readNumber(
  args: ToolArgs,
  key: string,
  defaultValue: number,
): number {
  const value = args[key];
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return defaultValue;
}

export function readStringArray(args: ToolArgs, key: string): string[] {
  const value = args[key];
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
}

export function formatOutput(output: string, maxChars = 120_000): string {
  if (maxChars <= 0) {
    return "";
  }

  if (output.length <= maxChars) {
    return output;
  }

  const marker = "\n\n... output truncated ...\n\n";

  // If the maximum allowed size is too small to include the marker and any
  // surrounding content, just return a prefix of the original output.
  if (maxChars <= marker.length) {
    return output.slice(0, maxChars);
  }

  const remaining = maxChars - marker.length;
  const headLength = Math.floor(remaining * 0.6);
  const tailLength = remaining - headLength;

  const head = output.slice(0, headLength);
  const tail = output.slice(output.length - tailLength);

  return `${head}${marker}${tail}`;
}

export function resolveRunnerPackage(runnerVersion: string): string {
  return runnerVersion === "latest"
    ? "mega-linter-runner"
    : `mega-linter-runner@${runnerVersion}`;
}
