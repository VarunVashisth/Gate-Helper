import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { app, BrowserWindow, net, protocol } from 'electron';
import { DatabaseService } from './database/database-service';
import { registerIpcHandlers } from './ipc/register-handlers';
import { AppDataService } from './services/app-data-service';
import { ApplicationService } from './services/application-service';
import { PdfService } from './services/imports/pdf-service';
import { OllamaService } from './services/llm/ollama-service';
import { BackupService } from './services/backup-service';
import { createMainWindow } from './windows/create-main-window';

// Electron Packager reserves names ending in " Helper" on macOS. Keep the
// user-facing brand exact while using a portable package artifact name.
app.setName('GATE 2027 Helper');

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'gate-helper',
    privileges: { standard: true, secure: true, supportFetchAPI: true },
  },
]);

const database = new DatabaseService();
const ollama = new OllamaService();

const registerAssetProtocol = (libraryRoot: string) => {
  protocol.handle('gate-helper', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'asset') return new Response('Not found', { status: 404 });

    const relativePath = decodeURIComponent(url.pathname).replace(/^\/+/, '');
    const requestedPath = path.resolve(libraryRoot, relativePath);
    const normalizedRoot = `${path.resolve(libraryRoot)}${path.sep}`.toLowerCase();
    if (!requestedPath.toLowerCase().startsWith(normalizedRoot)) {
      return new Response('Forbidden', { status: 403 });
    }
    if (!fs.existsSync(requestedPath) || !fs.statSync(requestedPath).isFile()) {
      return new Response('Not found', { status: 404 });
    }
    return net.fetch(pathToFileURL(requestedPath).toString());
  });
};

const start = async () => {
  const userDataRoot = app.getPath('userData');
  const libraryRoot = path.join(userDataRoot, 'library');
  fs.mkdirSync(libraryRoot, { recursive: true });
  const databasePath = path.join(userDataRoot, 'gate-helper.sqlite3');
  await database.initialize(databasePath);
  registerAssetProtocol(libraryRoot);
  const data = new AppDataService(database);
  const pdf = new PdfService(libraryRoot);
  const application = new ApplicationService(data, pdf, ollama);
  const backup = new BackupService(database, databasePath, libraryRoot);
  registerIpcHandlers({ database, data, application, ollama, backup });
  createMainWindow();
};

void app.whenReady().then(start).catch((error) => {
  console.error('Failed to start GATE 2027 Helper.', error);
  app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  void database.close();
});
