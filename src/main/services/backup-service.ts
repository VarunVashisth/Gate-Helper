import fs from 'node:fs/promises';
import path from 'node:path';
import { app, dialog } from 'electron';
import { z } from 'zod';
import type { DatabaseService } from '../database/database-service';

const manifestSchema = z.object({
  format: z.literal('gate-helper-backup'),
  version: z.literal(1),
  createdAt: z.string().datetime(),
  appVersion: z.string(),
});

export type BackupResult = { cancelled: boolean; path: string | null; message: string };

export class BackupService {
  constructor(
    private readonly database: DatabaseService,
    private readonly databasePath: string,
    private readonly libraryRoot: string,
  ) {}

  private async writeBackup(target: string) {
    await fs.mkdir(target, { recursive: false });
    try {
      await this.database.backup(path.join(target, 'gate-helper.sqlite3'));
      try {
        await fs.cp(this.libraryRoot, path.join(target, 'library'), { recursive: true, errorOnExist: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      }
      await fs.writeFile(path.join(target, 'manifest.json'), JSON.stringify({
        format: 'gate-helper-backup', version: 1, createdAt: new Date().toISOString(), appVersion: app.getVersion(),
      }, null, 2));
    } catch (error) {
      await fs.rm(target, { recursive: true, force: true });
      throw error;
    }
  }

  async export(): Promise<BackupResult> {
    const selection = await dialog.showOpenDialog({ title: 'Choose where to save the backup', properties: ['openDirectory', 'createDirectory'] });
    if (selection.canceled || !selection.filePaths[0]) return { cancelled: true, path: null, message: 'Backup cancelled.' };
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const target = path.join(selection.filePaths[0], `GATE-Helper-Backup-${stamp}`);
    await this.writeBackup(target);
    return { cancelled: false, path: target, message: 'Backup created successfully.' };
  }

  async restore(): Promise<BackupResult> {
    const selection = await dialog.showOpenDialog({ title: 'Choose a GATE Helper backup folder', properties: ['openDirectory'] });
    if (selection.canceled || !selection.filePaths[0]) return { cancelled: true, path: null, message: 'Restore cancelled.' };
    const source = path.resolve(selection.filePaths[0]);
    const managedLibrary = path.resolve(this.libraryRoot);
    if (source === managedLibrary || source.startsWith(`${managedLibrary}${path.sep}`)) {
      throw new Error('Choose a backup outside the application’s managed document library.');
    }
    const manifest = manifestSchema.parse(JSON.parse(await fs.readFile(path.join(source, 'manifest.json'), 'utf8')));
    const sourceDatabase = path.join(source, 'gate-helper.sqlite3');
    const sourceStats = await fs.stat(sourceDatabase);
    if (!sourceStats.isFile() || sourceStats.size === 0) throw new Error('The backup database is missing or empty.');
    const confirmation = await dialog.showMessageBox({
      type: 'warning', buttons: ['Restore and restart', 'Cancel'], defaultId: 1, cancelId: 1,
      title: 'Restore local data?',
      message: `Restore backup from ${new Date(manifest.createdAt).toLocaleString()}?`,
      detail: 'Current data will be preserved in an automatic recovery backup before it is replaced.',
    });
    if (confirmation.response !== 0) return { cancelled: true, path: null, message: 'Restore cancelled.' };

    const userDataRoot = path.dirname(this.databasePath);
    const recovery = path.join(userDataRoot, `recovery-${Date.now()}`);
    await this.writeBackup(recovery);
    await this.database.close();
    try {
      await Promise.all([
        fs.rm(`${this.databasePath}-wal`, { force: true }),
        fs.rm(`${this.databasePath}-shm`, { force: true }),
      ]);
      await fs.copyFile(sourceDatabase, this.databasePath);
      await fs.rm(this.libraryRoot, { recursive: true, force: true });
      const sourceLibrary = path.join(source, 'library');
      try {
        await fs.cp(sourceLibrary, this.libraryRoot, { recursive: true });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
        await fs.mkdir(this.libraryRoot, { recursive: true });
      }
      app.relaunch();
      app.exit(0);
      return { cancelled: false, path: recovery, message: 'Backup restored. Restarting…' };
    } catch (error) {
      await fs.copyFile(path.join(recovery, 'gate-helper.sqlite3'), this.databasePath);
      await fs.rm(this.libraryRoot, { recursive: true, force: true });
      await fs.cp(path.join(recovery, 'library'), this.libraryRoot, { recursive: true }).catch(() => undefined);
      await this.database.initialize(this.databasePath);
      throw new Error(`Restore failed; current data was recovered. ${error instanceof Error ? error.message : ''}`.trim(), { cause: error });
    }
  }
}
