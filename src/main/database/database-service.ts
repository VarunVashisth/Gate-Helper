import path from 'node:path';
import { Worker } from 'node:worker_threads';
import type { AppSettings, SettingsPatch } from '../../shared/contracts/api';
import { settingsSchema } from '../../shared/contracts/api';

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

export class DatabaseService {
  private worker: Worker | undefined;
  private nextId = 1;
  private readonly pending = new Map<number, PendingRequest>();

  async initialize(databasePath: string) {
    this.worker = new Worker(path.join(__dirname, 'database.worker.js'));
    this.worker.on('message', (message: { id: number; result?: unknown; error?: string }) => {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error));
      else pending.resolve(message.result);
    });
    this.worker.on('error', (error) =>
      this.rejectAll(error instanceof Error ? error : new Error(String(error))),
    );
    this.worker.on('exit', (code) => {
      if (code !== 0) this.rejectAll(new Error(`Database worker exited with code ${code}.`));
    });
    await this.request('initialize', { databasePath });
  }

  async getSettings(): Promise<AppSettings> {
    return settingsSchema.parse(await this.request('get-settings'));
  }

  async updateSettings(patch: SettingsPatch): Promise<AppSettings> {
    return settingsSchema.parse(await this.request('update-settings', patch));
  }

  async listRecords<T>(kind: string): Promise<T[]> {
    return (await this.request('record-list', { kind })) as T[];
  }

  async getRecord<T>(kind: string, id: string): Promise<T | null> {
    return (await this.request('record-get', { kind, id })) as T | null;
  }

  async putRecord<T>(kind: string, id: string, value: T): Promise<T> {
    return (await this.request('record-put', { kind, id, value })) as T;
  }

  async deleteRecord(kind: string, id: string): Promise<void> {
    await this.request('record-delete', { kind, id });
  }

  async backup(targetPath: string) {
    await this.request('backup', { targetPath });
  }

  async close() {
    if (!this.worker) return;
    await this.request('close');
    await this.worker.terminate();
    this.worker = undefined;
  }

  private request(operation: string, payload?: Record<string, unknown>) {
    if (!this.worker) return Promise.reject(new Error('Database worker is not running.'));
    const id = this.nextId++;
    return new Promise<unknown>((resolve, reject) => {
      this.pending.set(id, { resolve, reject });
      this.worker?.postMessage({ id, operation, payload });
    });
  }

  private rejectAll(error: Error) {
    for (const request of this.pending.values()) request.reject(error);
    this.pending.clear();
  }
}
