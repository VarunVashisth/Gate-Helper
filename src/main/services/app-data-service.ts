import { randomUUID } from 'node:crypto';
import type {
  Attempt,
  SourceDocument,
  StudyTask,
  StudyTaskInput,
  Syllabus,
  SyllabusTopicInput,
  TestPaper,
  TestPaperInput,
  TutorThread,
} from '../../shared/contracts/api';
import {
  attemptSchema,
  sourceDocumentSchema,
  studyTaskInputSchema,
  studyTaskSchema,
  syllabusSchema,
  syllabusTopicInputSchema,
  testPaperInputSchema,
  testPaperSchema,
  tutorThreadSchema,
} from '../../shared/contracts/api';
import type { DatabaseService } from '../database/database-service';
import { scoreAttempt } from '../../shared/domain/scoring';

const KINDS = {
  syllabus: 'syllabus',
  task: 'study-task',
  test: 'test',
  attempt: 'attempt',
  document: 'document',
  thread: 'tutor-thread',
} as const;

const DEFAULT_SYLLABUS: Syllabus = { paperName: '', topics: [] };

export class AppDataService {
  constructor(private readonly database: DatabaseService) {}

  async getSyllabus() {
    return syllabusSchema.parse(
      (await this.database.getRecord<Syllabus>(KINDS.syllabus, 'default')) ?? DEFAULT_SYLLABUS,
    );
  }

  async setPaperName(paperName: string) {
    const syllabus = await this.getSyllabus();
    syllabus.paperName = paperName.trim().slice(0, 120);
    return this.saveSyllabus(syllabus);
  }

  async saveTopic(input: SyllabusTopicInput) {
    const topic = syllabusTopicInputSchema.parse(input);
    const syllabus = await this.getSyllabus();
    if (topic.parentId && !syllabus.topics.some((item) => item.id === topic.parentId)) {
      throw new Error('The selected parent topic no longer exists.');
    }
    if (topic.id && topic.parentId) {
      const descendants = new Set([topic.id]);
      let expanded = true;
      while (expanded) {
        expanded = false;
        for (const item of syllabus.topics) {
          if (item.parentId && descendants.has(item.parentId) && !descendants.has(item.id)) {
            descendants.add(item.id);
            expanded = true;
          }
        }
      }
      if (descendants.has(topic.parentId)) {
        throw new Error('A topic cannot be moved underneath itself or one of its subtopics.');
      }
    }
    const existingIndex = topic.id ? syllabus.topics.findIndex((item) => item.id === topic.id) : -1;
    const value = {
      ...topic,
      id: topic.id ?? randomUUID(),
      position: existingIndex >= 0 ? syllabus.topics[existingIndex].position : syllabus.topics.length,
    };
    if (existingIndex >= 0) syllabus.topics[existingIndex] = value;
    else syllabus.topics.push(value);
    return this.saveSyllabus(syllabus);
  }

  async toggleTopic(id: string, completed: boolean) {
    const syllabus = await this.getSyllabus();
    if (!syllabus.topics.some((topic) => topic.id === id)) throw new Error('Topic not found.');
    const descendants = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const topic of syllabus.topics) {
        if (topic.parentId && descendants.has(topic.parentId) && !descendants.has(topic.id)) {
          descendants.add(topic.id);
          changed = true;
        }
      }
    }
    syllabus.topics = syllabus.topics.map((topic) =>
      descendants.has(topic.id) ? { ...topic, completed } : topic,
    );

    for (let index = syllabus.topics.length - 1; index >= 0; index -= 1) {
      const parent = syllabus.topics[index];
      const children = syllabus.topics.filter((topic) => topic.parentId === parent.id);
      if (children.length > 0) parent.completed = children.every((child) => child.completed);
    }
    return this.saveSyllabus(syllabus);
  }

  async deleteTopic(id: string) {
    const syllabus = await this.getSyllabus();
    const removed = new Set([id]);
    let changed = true;
    while (changed) {
      changed = false;
      for (const topic of syllabus.topics) {
        if (topic.parentId && removed.has(topic.parentId) && !removed.has(topic.id)) {
          removed.add(topic.id);
          changed = true;
        }
      }
    }
    syllabus.topics = syllabus.topics.filter((topic) => !removed.has(topic.id));
    return this.saveSyllabus(syllabus);
  }

  private async saveSyllabus(syllabus: Syllabus) {
    const validated = syllabusSchema.parse(syllabus);
    await this.database.putRecord(KINDS.syllabus, 'default', validated);
    return validated;
  }

  async listTasks() {
    return (await this.database.listRecords<StudyTask>(KINDS.task)).map((item) => studyTaskSchema.parse(item));
  }

  async createTask(input: StudyTaskInput) {
    const value = studyTaskInputSchema.parse(input);
    const task = studyTaskSchema.parse({
      ...value,
      id: randomUUID(),
      completed: false,
      createdAt: new Date().toISOString(),
    });
    return this.database.putRecord(KINDS.task, task.id, task);
  }

  async toggleTask(id: string, completed: boolean) {
    const task = await this.requireRecord<StudyTask>(KINDS.task, id, 'Study task');
    return this.database.putRecord(KINDS.task, id, studyTaskSchema.parse({ ...task, completed }));
  }

  async deleteTask(id: string) {
    await this.database.deleteRecord(KINDS.task, id);
  }

  async listTests() {
    return (await this.database.listRecords<TestPaper>(KINDS.test)).map((item) => testPaperSchema.parse(item));
  }

  async getTest(id: string) {
    const value = await this.database.getRecord<TestPaper>(KINDS.test, id);
    return value ? testPaperSchema.parse(value) : null;
  }

  async saveTest(input: TestPaperInput & { id?: string }) {
    const id = input.id ?? randomUUID();
    const existing = await this.getTest(id);
    const value = testPaperInputSchema.parse(input);
    if (value.status === 'published') this.assertPublishable(value);
    const now = new Date().toISOString();
    const test = testPaperSchema.parse({
      ...value,
      id,
      createdAt: existing?.createdAt ?? now,
      updatedAt: now,
    });
    return this.database.putRecord(KINDS.test, id, test);
  }

  async deleteTest(id: string) {
    const attempts = await this.listAttempts();
    if (attempts.some((attempt) => attempt.testId === id)) {
      throw new Error('This test has attempt history and cannot be deleted. Keep it for result integrity.');
    }
    await this.database.deleteRecord(KINDS.test, id);
  }

  private assertPublishable(test: TestPaperInput) {
    if (test.questions.length === 0) throw new Error('Add at least one valid question before publishing.');
    for (const question of test.questions) {
      if (question.correctAnswers.some((answer) => answer === 'REVIEW_REQUIRED')) {
        throw new Error(`Question ${question.position} still needs a verified answer.`);
      }
      if ((question.type === 'MCQ' || question.type === 'MSQ') && question.options.length < 2) {
        throw new Error(`Question ${question.position} needs at least two options.`);
      }
      if (question.type === 'MCQ' && question.correctAnswers.length !== 1) {
        throw new Error(`Question ${question.position} must have exactly one correct answer.`);
      }
      if (question.type === 'NAT' && question.correctAnswers.length !== 1) {
        throw new Error(`Question ${question.position} must have one numerical answer or range.`);
      }
      if (question.negativeMarks > question.marks) {
        throw new Error(`Question ${question.position} has negative marks greater than its positive marks.`);
      }
    }
  }

  async listAttempts() {
    return (await this.database.listRecords<Attempt>(KINDS.attempt)).map((item) => attemptSchema.parse(item));
  }

  async startAttempt(testId: string) {
    const test = await this.getTest(testId);
    if (!test) throw new Error('Test not found.');
    if (test.status !== 'published') throw new Error('Only reviewed and published tests can be attempted.');
    const existing = (await this.listAttempts()).find(
      (attempt) => attempt.testId === testId && attempt.status === 'in-progress',
    );
    if (existing) return existing;
    const attempt = attemptSchema.parse({
      id: randomUUID(),
      testId,
      testTitle: test.title,
      status: 'in-progress',
      snapshot: structuredClone(test),
      answers: {},
      startedAt: new Date().toISOString(),
      submittedAt: null,
      durationSeconds: 0,
      score: null,
      correct: 0,
      incorrect: 0,
      unattempted: test.questions.length,
    });
    return this.database.putRecord(KINDS.attempt, attempt.id, attempt);
  }

  async saveAttemptAnswers(id: string, answers: Record<string, string[]>, durationSeconds: number) {
    const attempt = await this.requireRecord<Attempt>(KINDS.attempt, id, 'Attempt');
    if (attempt.status === 'submitted') throw new Error('A submitted attempt cannot be changed.');
    const updated = attemptSchema.parse({ ...attempt, answers, durationSeconds });
    return this.database.putRecord(KINDS.attempt, id, updated);
  }

  async submitAttempt(id: string, answers: Record<string, string[]>, durationSeconds: number) {
    const attempt = await this.requireRecord<Attempt>(KINDS.attempt, id, 'Attempt');
    if (attempt.status === 'submitted') return attempt;
    const result = scoreAttempt(attempt.snapshot.questions, answers);
    const submitted = attemptSchema.parse({
      ...attempt,
      answers,
      durationSeconds,
      status: 'submitted',
      submittedAt: new Date().toISOString(),
      score: result.score,
      correct: result.correct,
      incorrect: result.incorrect,
      unattempted: result.unattempted,
    });
    return this.database.putRecord(KINDS.attempt, id, submitted);
  }

  async listDocuments() {
    return (await this.database.listRecords<SourceDocument>(KINDS.document)).map((item) =>
      sourceDocumentSchema.parse(item),
    );
  }

  async saveDocument(document: SourceDocument) {
    const validated = sourceDocumentSchema.parse(document);
    return this.database.putRecord(KINDS.document, validated.id, validated);
  }

  async deleteDocument(id: string) {
    await this.database.deleteRecord(KINDS.document, id);
  }

  async listThreads() {
    return (await this.database.listRecords<TutorThread>(KINDS.thread)).map((item) => tutorThreadSchema.parse(item));
  }

  async createThread(model: string) {
    const now = new Date().toISOString();
    const thread = tutorThreadSchema.parse({
      id: randomUUID(), title: 'New conversation', mode: 'knowledge', model,
      messages: [], createdAt: now, updatedAt: now,
    });
    return this.saveThread(thread);
  }

  async getThread(id: string) {
    const value = await this.database.getRecord<TutorThread>(KINDS.thread, id);
    return value ? tutorThreadSchema.parse(value) : null;
  }

  async saveThread(thread: TutorThread) {
    const validated = tutorThreadSchema.parse(thread);
    return this.database.putRecord(KINDS.thread, validated.id, validated);
  }

  async deleteThread(id: string) {
    await this.database.deleteRecord(KINDS.thread, id);
  }

  private async requireRecord<T>(kind: string, id: string, label: string) {
    const value = await this.database.getRecord<T>(kind, id);
    if (!value) throw new Error(`${label} not found.`);
    return value;
  }
}
