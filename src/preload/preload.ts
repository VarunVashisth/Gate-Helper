import { contextBridge, ipcRenderer } from 'electron';
import type { GateHelperApi } from '../shared/contracts/api';
import { IPC_CHANNELS } from '../shared/contracts/channels';

const gateHelperApi: GateHelperApi = {
  app: {
    getInfo: () => ipcRenderer.invoke(IPC_CHANNELS.appInfo),
    exportBackup: () => ipcRenderer.invoke(IPC_CHANNELS.appExportBackup),
    restoreBackup: () => ipcRenderer.invoke(IPC_CHANNELS.appRestoreBackup),
  },
  settings: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.settingsGet),
    update: (patch) => ipcRenderer.invoke(IPC_CHANNELS.settingsUpdate, patch),
  },
  syllabus: {
    get: () => ipcRenderer.invoke(IPC_CHANNELS.syllabusGet),
    setPaperName: (paperName) => ipcRenderer.invoke(IPC_CHANNELS.syllabusSetPaperName, paperName),
    saveTopic: (topic) => ipcRenderer.invoke(IPC_CHANNELS.syllabusSaveTopic, topic),
    toggleTopic: (id, completed) => ipcRenderer.invoke(IPC_CHANNELS.syllabusToggleTopic, { id, completed }),
    deleteTopic: (id) => ipcRenderer.invoke(IPC_CHANNELS.syllabusDeleteTopic, id),
  },
  tests: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.testsList),
    get: (id) => ipcRenderer.invoke(IPC_CHANNELS.testsGet, id),
    save: (test) => ipcRenderer.invoke(IPC_CHANNELS.testsSave, test),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.testsDelete, id),
    importPdf: (request) => ipcRenderer.invoke(IPC_CHANNELS.testsImportPdf, request),
  },
  attempts: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.attemptsList),
    start: (testId) => ipcRenderer.invoke(IPC_CHANNELS.attemptsStart, testId),
    saveAnswers: (attemptId, answers, durationSeconds) =>
      ipcRenderer.invoke(IPC_CHANNELS.attemptsSaveAnswers, { attemptId, answers, durationSeconds }),
    submit: (attemptId, answers, durationSeconds) =>
      ipcRenderer.invoke(IPC_CHANNELS.attemptsSubmit, { attemptId, answers, durationSeconds }),
  },
  imports: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.importsStatus),
  },
  documents: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.documentsList),
    importPdf: (embeddingModel) => ipcRenderer.invoke(IPC_CHANNELS.documentsImportPdf, embeddingModel),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.documentsDelete, id),
  },
  planner: {
    list: () => ipcRenderer.invoke(IPC_CHANNELS.plannerList),
    create: (task) => ipcRenderer.invoke(IPC_CHANNELS.plannerCreate, task),
    toggle: (id, completed) => ipcRenderer.invoke(IPC_CHANNELS.plannerToggle, { id, completed }),
    delete: (id) => ipcRenderer.invoke(IPC_CHANNELS.plannerDelete, id),
  },
  tutor: {
    getStatus: () => ipcRenderer.invoke(IPC_CHANNELS.tutorStatus),
    listThreads: () => ipcRenderer.invoke(IPC_CHANNELS.tutorThreadsList),
    createThread: (model) => ipcRenderer.invoke(IPC_CHANNELS.tutorThreadCreate, model),
    deleteThread: (id) => ipcRenderer.invoke(IPC_CHANNELS.tutorThreadDelete, id),
    chat: async (request, onEvent) => {
      const listener = (_event: Electron.IpcRendererEvent, payload: unknown) => {
        const streamEvent = payload as Parameters<typeof onEvent>[0];
        if (streamEvent.requestId === request.requestId) onEvent(streamEvent);
      };
      ipcRenderer.on(IPC_CHANNELS.tutorStreamEvent, listener);
      try {
        await ipcRenderer.invoke(IPC_CHANNELS.tutorChat, request);
      } finally {
        ipcRenderer.removeListener(IPC_CHANNELS.tutorStreamEvent, listener);
      }
    },
    cancel: (requestId) => ipcRenderer.invoke(IPC_CHANNELS.tutorCancel, requestId),
  },
};

contextBridge.exposeInMainWorld('gateHelper', gateHelperApi);
