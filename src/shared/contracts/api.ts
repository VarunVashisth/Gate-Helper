import { z } from 'zod';

export const appInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
  platform: z.enum(['win32', 'linux', 'darwin']),
  databaseReady: z.boolean(),
});

export type AppInfo = z.infer<typeof appInfoSchema>;

export const settingsSchema = z.object({
  selectedOllamaModel: z.string().nullable(),
  sidebarCollapsed: z.boolean(),
});

export type AppSettings = z.infer<typeof settingsSchema>;

export const settingsPatchSchema = settingsSchema.partial();
export type SettingsPatch = z.infer<typeof settingsPatchSchema>;

export const ollamaModelSchema = z.object({
  name: z.string(),
  size: z.number().nonnegative(),
  parameterSize: z.string().nullable(),
  quantization: z.string().nullable(),
});

export type OllamaModel = z.infer<typeof ollamaModelSchema>;

export const ollamaStatusSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('unavailable'),
    message: z.string(),
    models: z.array(ollamaModelSchema),
    checkedAt: z.string(),
  }),
  z.object({
    state: z.literal('no-models'),
    message: z.string(),
    models: z.array(ollamaModelSchema),
    checkedAt: z.string(),
  }),
  z.object({
    state: z.literal('ready'),
    message: z.string(),
    models: z.array(ollamaModelSchema),
    checkedAt: z.string(),
  }),
]);

export type OllamaStatus = z.infer<typeof ollamaStatusSchema>;

export const featureStatusSchema = z.object({
  available: z.boolean(),
  phase: z.string(),
});

export type FeatureStatus = z.infer<typeof featureStatusSchema>;

const identifierSchema = z.string().min(1).max(128);

export const syllabusTopicSchema = z.object({
  id: identifierSchema,
  parentId: identifierSchema.nullable(),
  title: z.string().trim().min(1).max(200),
  notes: z.string().max(4000).default(''),
  targetDate: z.string().nullable(),
  priority: z.enum(['low', 'normal', 'high']).default('normal'),
  completed: z.boolean().default(false),
  position: z.number().int().nonnegative(),
});
export type SyllabusTopic = z.infer<typeof syllabusTopicSchema>;

export const syllabusSchema = z.object({
  paperName: z.string().trim().max(120).default(''),
  topics: z.array(syllabusTopicSchema),
});
export type Syllabus = z.infer<typeof syllabusSchema>;

export const syllabusTopicInputSchema = syllabusTopicSchema.omit({ id: true, position: true }).extend({
  id: identifierSchema.optional(),
});
export type SyllabusTopicInput = z.input<typeof syllabusTopicInputSchema>;

export const studyTaskSchema = z.object({
  id: identifierSchema,
  title: z.string().trim().min(1).max(200),
  description: z.string().max(2000).default(''),
  scheduledDate: z.string().min(10).max(32),
  durationMinutes: z.number().int().min(5).max(720),
  kind: z.enum(['study', 'revision', 'test']),
  topicId: identifierSchema.nullable(),
  completed: z.boolean(),
  createdAt: z.string(),
});
export type StudyTask = z.infer<typeof studyTaskSchema>;
export const studyTaskInputSchema = studyTaskSchema.omit({ id: true, completed: true, createdAt: true });
export type StudyTaskInput = z.infer<typeof studyTaskInputSchema>;

export const questionTypeSchema = z.enum(['MCQ', 'MSQ', 'NAT']);
export const questionSchema = z.object({
  id: identifierSchema,
  position: z.number().int().positive(),
  type: questionTypeSchema,
  stem: z.string().trim().min(1).max(20000),
  options: z.array(z.string().max(5000)).max(10),
  correctAnswers: z.array(z.string().max(500)).min(1),
  marks: z.number().positive().max(100),
  negativeMarks: z.number().nonnegative().max(100),
  explanation: z.string().max(10000).default(''),
  sourcePage: z.number().int().positive().nullable(),
  sourceImageUrl: z.string().nullable(),
});
export type Question = z.infer<typeof questionSchema>;

export const testPaperSchema = z.object({
  id: identifierSchema,
  title: z.string().trim().min(1).max(240),
  durationMinutes: z.number().int().min(1).max(600),
  status: z.enum(['draft', 'published']),
  sourcePdfUrl: z.string().nullable(),
  answerPdfUrl: z.string().nullable(),
  sourceHash: z.string().length(64).nullable().default(null),
  answerHash: z.string().length(64).nullable().default(null),
  questions: z.array(questionSchema),
  warnings: z.array(z.string()),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TestPaper = z.infer<typeof testPaperSchema>;

export const testPaperInputSchema = testPaperSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type TestPaperInput = z.infer<typeof testPaperInputSchema>;

export const pdfImportRequestSchema = z.object({
  title: z.string().trim().min(1).max(240),
  durationMinutes: z.number().int().min(1).max(600),
  model: z.string().min(1),
});
export type PdfImportRequest = z.infer<typeof pdfImportRequestSchema>;

export const attemptSchema = z.object({
  id: identifierSchema,
  testId: identifierSchema,
  testTitle: z.string(),
  status: z.enum(['in-progress', 'submitted']),
  snapshot: testPaperSchema,
  answers: z.record(z.string(), z.array(z.string())),
  startedAt: z.string(),
  submittedAt: z.string().nullable(),
  durationSeconds: z.number().int().nonnegative(),
  score: z.number().nullable(),
  correct: z.number().int().nonnegative(),
  incorrect: z.number().int().nonnegative(),
  unattempted: z.number().int().nonnegative(),
});
export type Attempt = z.infer<typeof attemptSchema>;

export const sourceDocumentSchema = z.object({
  id: identifierSchema,
  name: z.string().min(1),
  sourcePdfUrl: z.string(),
  sourceHash: z.string().length(64).or(z.literal('')).default(''),
  pageCount: z.number().int().positive(),
  embeddingModel: z.string(),
  chunks: z.array(z.object({
    page: z.number().int().positive(),
    text: z.string(),
    embedding: z.array(z.number()),
  })),
  createdAt: z.string(),
});
export type SourceDocument = z.infer<typeof sourceDocumentSchema>;

export const tutorMessageSchema = z.object({
  id: identifierSchema,
  role: z.enum(['user', 'assistant']),
  content: z.string(),
  citations: z.array(z.object({ documentName: z.string(), page: z.number().int().positive() })),
  createdAt: z.string(),
});
export type TutorMessage = z.infer<typeof tutorMessageSchema>;

export const tutorThreadSchema = z.object({
  id: identifierSchema,
  title: z.string(),
  mode: z.enum(['knowledge', 'documents']),
  model: z.string(),
  messages: z.array(tutorMessageSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type TutorThread = z.infer<typeof tutorThreadSchema>;

export const tutorChatRequestSchema = z.object({
  threadId: identifierSchema.nullable(),
  content: z.string().trim().min(1).max(20000),
  model: z.string().min(1),
  mode: z.enum(['knowledge', 'documents']),
  documentIds: z.array(identifierSchema).default([]),
  requestId: identifierSchema,
});
export type TutorChatRequest = z.infer<typeof tutorChatRequestSchema>;

export type TutorStreamEvent =
  | { requestId: string; type: 'start'; threadId: string }
  | { requestId: string; type: 'chunk'; content: string }
  | { requestId: string; type: 'done'; thread: TutorThread }
  | { requestId: string; type: 'error'; message: string };

export interface GateHelperApi {
  app: {
    getInfo: () => Promise<AppInfo>;
    exportBackup: () => Promise<{ cancelled: boolean; path: string | null; message: string }>;
    restoreBackup: () => Promise<{ cancelled: boolean; path: string | null; message: string }>;
  };
  settings: {
    get: () => Promise<AppSettings>;
    update: (patch: SettingsPatch) => Promise<AppSettings>;
  };
  syllabus: {
    get: () => Promise<Syllabus>;
    setPaperName: (paperName: string) => Promise<Syllabus>;
    saveTopic: (topic: SyllabusTopicInput) => Promise<Syllabus>;
    toggleTopic: (id: string, completed: boolean) => Promise<Syllabus>;
    deleteTopic: (id: string) => Promise<Syllabus>;
  };
  tests: {
    list: () => Promise<TestPaper[]>;
    get: (id: string) => Promise<TestPaper | null>;
    save: (test: TestPaperInput & { id?: string }) => Promise<TestPaper>;
    delete: (id: string) => Promise<void>;
    importPdf: (request: PdfImportRequest) => Promise<TestPaper>;
  };
  attempts: {
    list: () => Promise<Attempt[]>;
    start: (testId: string) => Promise<Attempt>;
    saveAnswers: (attemptId: string, answers: Record<string, string[]>, durationSeconds: number) => Promise<Attempt>;
    submit: (attemptId: string, answers: Record<string, string[]>, durationSeconds: number) => Promise<Attempt>;
  };
  imports: {
    getStatus: () => Promise<FeatureStatus>;
  };
  documents: {
    list: () => Promise<SourceDocument[]>;
    importPdf: (embeddingModel: string) => Promise<SourceDocument>;
    delete: (id: string) => Promise<void>;
  };
  planner: {
    list: () => Promise<StudyTask[]>;
    create: (task: StudyTaskInput) => Promise<StudyTask>;
    toggle: (id: string, completed: boolean) => Promise<StudyTask>;
    delete: (id: string) => Promise<void>;
  };
  tutor: {
    getStatus: () => Promise<OllamaStatus>;
    listThreads: () => Promise<TutorThread[]>;
    createThread: (model: string) => Promise<TutorThread>;
    deleteThread: (id: string) => Promise<void>;
    chat: (request: TutorChatRequest, onEvent: (event: TutorStreamEvent) => void) => Promise<void>;
    cancel: (requestId: string) => Promise<void>;
  };
}
