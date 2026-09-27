import { existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { join } from "node:path";

const projectRoot = join(import.meta.dirname, "..");
const virtualEnvironmentPython = process.platform === "win32"
  ? join(projectRoot, ".venv", "Scripts", "python.exe")
  : join(projectRoot, ".venv", "bin", "python");
const python = process.env.PYTHON_EXECUTABLE
  ?? (existsSync(virtualEnvironmentPython) ? virtualEnvironmentPython : "python");

const child = spawn(python, process.argv.slice(2), {
  cwd: projectRoot,
  env: process.env,
  stdio: "inherit",
  windowsHide: true,
});

child.once("error", (error) => {
  console.error(`Unable to start Python from ${python}:`, error.message);
  process.exitCode = 1;
});

child.once("exit", (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.once(signal, () => child.kill(signal));
}

