import { spawn } from "node:child_process";

export function createExternalLatexAdapter(overrides = {}) {
  return {
    commandExists,
    runCommand,
    ...overrides
  };
}

export async function commandExists(command, runner = runCommand) {
  const result = await runner("command", ["-v", command], { shell: true });
  return result.exitCode === 0;
}

export function runCommand(command, args = [], options = {}) {
  return new Promise((resolve) => {
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell || false
    });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      resolve({ exitCode: 127, stdout, stderr: stderr || error.message, error });
    });
    child.on("close", (exitCode) => {
      resolve({ exitCode, stdout, stderr });
    });
  });
}
