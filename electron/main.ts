import { app, BrowserWindow, dialog } from "electron";
import { ChildProcess, spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { join } from "node:path";

const backendHost = "127.0.0.1";
const backendPort = 8000;
let backendProcess: ChildProcess | null = null;

function startBackend(): ChildProcess {
  const isPackaged = app.isPackaged;
  const projectRoot = join(__dirname, "..");
  const localVirtualEnvironment = join(projectRoot, ".venv", "Scripts", "python.exe");
  const developmentPython = process.env.PYTHON_EXECUTABLE ?? (existsSync(localVirtualEnvironment) ? localVirtualEnvironment : "python");
  const executable = isPackaged ? join(process.resourcesPath, "backend", "gate-helper-backend.exe") : developmentPython;
  const args = isPackaged ? [] : ["-m", "uvicorn", "backend.main:app", "--host", backendHost, "--port", String(backendPort)];
  if (isPackaged && !existsSync(executable)) throw new Error(`Bundled backend was not found at ${executable}`);
  const frontendDirectory = join(isPackaged ? process.resourcesPath : projectRoot, "frontend", "dist");
  return spawn(executable, args, {
    cwd: isPackaged ? process.resourcesPath : projectRoot,
    env: {
      ...process.env,
      GATE_HELPER_MODE: "desktop",
      ...(isPackaged ? { GATE_HELPER_FRONTEND_DIR: frontendDirectory } : {}),
    },
    stdio: "inherit",
    windowsHide: true,
  });
}

async function waitForBackend(timeoutMs = 15_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`http://${backendHost}:${backendPort}/api/health`);
      if (response.ok) return;
    } catch { /* Backend is still starting. */ }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("The local backend did not become ready within 15 seconds.");
}

async function createWindow(): Promise<void> {
  const window = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 760,
    minHeight: 600,
    backgroundColor: "#071315",
    show: false,
    webPreferences: {
      preload: join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.once("ready-to-show", () => window.show());
  const rendererUrl = process.env.ELECTRON_RENDERER_URL;
  if (rendererUrl) await window.loadURL(rendererUrl);
  else await window.loadURL(`http://${backendHost}:${backendPort}`);
}

app.whenReady().then(async () => {
  try {
    backendProcess = startBackend();
    backendProcess.once("exit", (code) => {
      if (code && code !== 0) dialog.showErrorBox("Backend stopped", `The GATE Helper backend exited with code ${code}.`);
    });
    await waitForBackend();
    await createWindow();
  } catch (error) {
    dialog.showErrorBox("Unable to start GATE Helper", error instanceof Error ? error.message : String(error));
    app.quit();
  }
});

app.on("window-all-closed", () => app.quit());
app.on("before-quit", () => {
  if (backendProcess && !backendProcess.killed) backendProcess.kill();
  backendProcess = null;
});

