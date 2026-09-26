import { app, ipcMain, type IpcMainInvokeEvent } from 'electron';
import { z } from 'zod';
import {
  pdfImportRequestSchema,
  settingsPatchSchema,
  studyTaskInputSchema,
  syllabusTopicInputSchema,
  testPaperInputSchema,
  tutorChatRequestSchema,
} from '../../shared/contracts/api';
import { IPC_CHANNELS } from '../../shared/contracts/channels';
import type { DatabaseService } from '../database/database-service';
import type { AppDataService } from '../services/app-data-service';
import type { ApplicationService } from '../services/application-service';
import type { OllamaService } from '../services/llm/ollama-service';
import type { BackupService } from '../services/backup-service';

type HandlerDependencies = {
  database: DatabaseService;
  data: AppDataService;
  application: ApplicationService;
  ollama: OllamaService;
  backup: BackupService;
};

const idSchema = z.string().min(1).max(128);
const answerMapSchema = z.record(z.string(), z.array(z.string().max(500)));
const abortControllers = new Map<string, AbortController>();

const validateSender = (event: IpcMainInvokeEvent) => {
  const senderUrl = event.senderFrame?.url ?? '';
  const allowed =
    senderUrl.startsWith('file://') ||
    (MAIN_WINDOW_VITE_DEV_SERVER_URL && senderUrl.startsWith(MAIN_WINDOW_VITE_DEV_SERVER_URL));
  if (!allowed) throw new Error('Blocked IPC request from an untrusted renderer.');
};

const withSender = <T extends unknown[], R>(handler: (event: IpcMainInvokeEvent, ...args: T) => R) =>
  (event: IpcMainInvokeEvent, ...args: T) => {
    validateSender(event);
    return handler(event, ...args);
  };

export const registerIpcHandlers = ({ database, data, application, ollama, backup }: HandlerDependencies) => {
  ipcMain.handle(IPC_CHANNELS.appInfo, withSender(() => ({
    name: app.getName(), version: app.getVersion(), platform: process.platform, databaseReady: true,
  })));
  ipcMain.handle(IPC_CHANNELS.settingsGet, withSender(() => database.getSettings()));
  ipcMain.handle(IPC_CHANNELS.settingsUpdate, withSender((_event, input: unknown) =>
    database.updateSettings(settingsPatchSchema.parse(input))));

  ipcMain.handle(IPC_CHANNELS.syllabusGet, withSender(() => data.getSyllabus()));
  ipcMain.handle(IPC_CHANNELS.syllabusSetPaperName, withSender((_event, input: unknown) =>
    data.setPaperName(z.string().max(120).parse(input))));
  ipcMain.handle(IPC_CHANNELS.syllabusSaveTopic, withSender((_event, input: unknown) =>
    data.saveTopic(syllabusTopicInputSchema.parse(input))));
  ipcMain.handle(IPC_CHANNELS.syllabusToggleTopic, withSender((_event, input: unknown) => {
    const value = z.object({ id: idSchema, completed: z.boolean() }).parse(input);
    return data.toggleTopic(value.id, value.completed);
  }));
  ipcMain.handle(IPC_CHANNELS.appExportBackup, withSender(() => backup.export()));
  ipcMain.handle(IPC_CHANNELS.appRestoreBackup, withSender(() => backup.restore()));
  ipcMain.handle(IPC_CHANNELS.syllabusDeleteTopic, withSender((_event, input: unknown) =>
    data.deleteTopic(idSchema.parse(input))));

  ipcMain.handle(IPC_CHANNELS.plannerList, withSender(() => data.listTasks()));
  ipcMain.handle(IPC_CHANNELS.plannerCreate, withSender((_event, input: unknown) =>
    data.createTask(studyTaskInputSchema.parse(input))));
  ipcMain.handle(IPC_CHANNELS.plannerToggle, withSender((_event, input: unknown) => {
    const value = z.object({ id: idSchema, completed: z.boolean() }).parse(input);
    return data.toggleTask(value.id, value.completed);
  }));
  ipcMain.handle(IPC_CHANNELS.plannerDelete, withSender((_event, input: unknown) =>
    data.deleteTask(idSchema.parse(input))));

  ipcMain.handle(IPC_CHANNELS.testsList, withSender(() => data.listTests()));
  ipcMain.handle(IPC_CHANNELS.testsGet, withSender((_event, input: unknown) => data.getTest(idSchema.parse(input))));
  ipcMain.handle(IPC_CHANNELS.testsSave, withSender((_event, input: unknown) => {
    const value = testPaperInputSchema.extend({ id: idSchema.optional() }).parse(input);
    return data.saveTest(value);
  }));
  ipcMain.handle(IPC_CHANNELS.testsDelete, withSender((_event, input: unknown) =>
    data.deleteTest(idSchema.parse(input))));
  ipcMain.handle(IPC_CHANNELS.testsImportPdf, withSender((_event, input: unknown) =>
    application.importTest(pdfImportRequestSchema.parse(input))));

  ipcMain.handle(IPC_CHANNELS.attemptsList, withSender(() => data.listAttempts()));
  ipcMain.handle(IPC_CHANNELS.attemptsStart, withSender((_event, input: unknown) =>
    data.startAttempt(idSchema.parse(input))));
  const parseAttemptUpdate = (input: unknown) => z.object({
    attemptId: idSchema,
    answers: answerMapSchema,
    durationSeconds: z.number().int().nonnegative(),
  }).parse(input);
  ipcMain.handle(IPC_CHANNELS.attemptsSaveAnswers, withSender((_event, input: unknown) => {
    const value = parseAttemptUpdate(input);
    return data.saveAttemptAnswers(value.attemptId, value.answers, value.durationSeconds);
  }));
  ipcMain.handle(IPC_CHANNELS.attemptsSubmit, withSender((_event, input: unknown) => {
    const value = parseAttemptUpdate(input);
    return data.submitAttempt(value.attemptId, value.answers, value.durationSeconds);
  }));

  ipcMain.handle(IPC_CHANNELS.importsStatus, withSender(() => ({ available: true, phase: 'PDF import and review' })));
  ipcMain.handle(IPC_CHANNELS.documentsList, withSender(() => data.listDocuments()));
  ipcMain.handle(IPC_CHANNELS.documentsImportPdf, withSender((_event, input: unknown) =>
    application.importDocument(z.string().min(1).parse(input))));
  ipcMain.handle(IPC_CHANNELS.documentsDelete, withSender((_event, input: unknown) =>
    application.deleteDocument(idSchema.parse(input))));

  ipcMain.handle(IPC_CHANNELS.tutorStatus, withSender(() => ollama.getStatus()));
  ipcMain.handle(IPC_CHANNELS.tutorThreadsList, withSender(() => data.listThreads()));
  ipcMain.handle(IPC_CHANNELS.tutorThreadCreate, withSender((_event, input: unknown) =>
    data.createThread(z.string().trim().min(1).max(200).parse(input))));
  ipcMain.handle(IPC_CHANNELS.tutorThreadDelete, withSender((_event, input: unknown) =>
    data.deleteThread(idSchema.parse(input))));
  ipcMain.handle(IPC_CHANNELS.tutorCancel, withSender((_event, input: unknown) => {
    const requestId = idSchema.parse(input);
    abortControllers.get(requestId)?.abort();
    abortControllers.delete(requestId);
  }));
  ipcMain.handle(IPC_CHANNELS.tutorChat, withSender(async (event, input: unknown) => {
    const request = tutorChatRequestSchema.parse(input);
    const controller = new AbortController();
    abortControllers.set(request.requestId, controller);
    try {
      await application.chat(
        request,
        (streamEvent) => {
          if (!event.sender.isDestroyed()) event.sender.send(IPC_CHANNELS.tutorStreamEvent, streamEvent);
        },
        controller.signal,
      );
    } catch (error) {
      if (!event.sender.isDestroyed()) {
        event.sender.send(IPC_CHANNELS.tutorStreamEvent, {
          requestId: request.requestId,
          type: 'error',
          message: error instanceof Error ? error.message : 'The tutor request failed.',
        });
      }
      throw error;
    } finally {
      abortControllers.delete(request.requestId);
    }
  }));
};
