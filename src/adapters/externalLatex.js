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
    let settled = false;
    let timedOut = false;
    let timeout = null;
    let forceKillTimeout = null;
    const child = spawn(command, args, {
      cwd: options.cwd,
      env: options.env,
      shell: options.shell || false
    });
    let stdout = "";
    let stderr = "";
    const cleanup = () => {
      if (timeout) clearTimeout(timeout);
      if (forceKillTimeout) clearTimeout(forceKillTimeout);
    };
    const finish = (result) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(result);
    };
    if (Number.isFinite(options.timeoutMs) && options.timeoutMs > 0) {
      timeout = setTimeout(() => {
        timedOut = true;
        stderr += `${stderr ? "\n" : ""}${command} timed out after ${options.timeoutMs}ms`;
        child.kill("SIGTERM");
        forceKillTimeout = setTimeout(() => {
          child.kill("SIGKILL");
        }, 1000);
      }, options.timeoutMs);
    }
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.on("error", (error) => {
      finish({ exitCode: timedOut ? 124 : 127, stdout, stderr: stderr || error.message, error, timedOut });
    });
    child.on("close", (exitCode) => {
      finish({ exitCode: timedOut ? 124 : exitCode, stdout, stderr, timedOut });
    });
  });
}
