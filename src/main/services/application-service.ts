import { randomUUID } from 'node:crypto';
import type {
  PdfImportRequest,
  Question,
  SourceDocument,
  TutorChatRequest,
  TutorMessage,
  TutorStreamEvent,
} from '../../shared/contracts/api';
import {
  pdfImportRequestSchema,
  questionSchema,
  sourceDocumentSchema,
  tutorChatRequestSchema,
  tutorThreadSchema,
} from '../../shared/contracts/api';
import type { AppDataService } from './app-data-service';
import { PdfService } from './imports/pdf-service';
import type { OllamaService } from './llm/ollama-service';

const cosineSimilarity = (left: number[], right: number[]) => {
  if (left.length !== right.length || left.length === 0) return -1;
  let dot = 0;
  let leftMagnitude = 0;
  let rightMagnitude = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftMagnitude += left[index] ** 2;
    rightMagnitude += right[index] ** 2;
  }
  const denominator = Math.sqrt(leftMagnitude) * Math.sqrt(rightMagnitude);
  return denominator === 0 ? -1 : dot / denominator;
};

export class ApplicationService {
  constructor(
    private readonly data: AppDataService,
    private readonly pdf: PdfService,
    private readonly ollama: OllamaService,
  ) {}

  private async ocrMissingPages(pdf: Awaited<ReturnType<PdfService['processPdf']>>, model: string) {
    const missing = pdf.pages.filter((page) => !page.text.trim());
    if (missing.length > 50) {
      pdf.warnings.push(`Skipped automatic OCR for ${missing.length} image-only pages; the safety limit is 50 pages per import.`);
      return;
    }
    for (const page of missing) {
      try {
        const image = await PdfService.pageImageBase64(page);
        page.text = await this.ollama.transcribePage(model, image, page.page);
        pdf.warnings = pdf.warnings.filter((warning) => !warning.startsWith(`Page ${page.page} has no extractable text`));
        pdf.warnings.push(`Page ${page.page} was transcribed by the selected vision model and requires visual review.`);
      } catch (error) {
        pdf.warnings.push(`Page ${page.page} OCR was unavailable: ${error instanceof Error ? error.message : 'unknown error'}`);
      }
    }
  }

  async importTest(input: PdfImportRequest) {
    const request = pdfImportRequestSchema.parse(input);
    const questionPath = await this.pdf.choosePdf('Choose the question paper PDF');
    if (!questionPath) throw new Error('Import cancelled before a question paper was selected.');
    const answerPath = await this.pdf.choosePdf('Choose an answer-key PDF (Cancel to continue without one)');

    const questionPdf = await this.pdf.processPdf(questionPath, 'tests');
    const duplicate = (await this.data.listTests()).find((test) => test.sourceHash === questionPdf.hash);
    if (duplicate) {
      await this.pdf.discard(questionPdf);
      throw new Error(`This question paper is already imported as “${duplicate.title}”.`);
    }
    let answerPdf: Awaited<ReturnType<PdfService['processPdf']>> | null = null;
    let extraction: Awaited<ReturnType<OllamaService['generateStructuredQuestions']>>;
    try {
      answerPdf = answerPath ? await this.pdf.processPdf(answerPath, 'tests') : null;
      await this.ocrMissingPages(questionPdf, request.model);
      if (answerPdf) await this.ocrMissingPages(answerPdf, request.model);
      extraction = await this.ollama.generateStructuredQuestions(
        request.model,
        PdfService.joinPageText(questionPdf),
        answerPdf ? PdfService.joinPageText(answerPdf) : '',
      );
    } catch (error) {
      await Promise.allSettled([this.pdf.discard(questionPdf), ...(answerPdf ? [this.pdf.discard(answerPdf)] : [])]);
      throw error;
    }
    const warnings = [
      ...questionPdf.warnings,
      ...(answerPdf?.warnings ?? []),
      ...(Array.isArray(extraction.warnings) ? extraction.warnings.map(String) : []),
    ];
    if (!answerPdf) warnings.push('No answer-key PDF was supplied. Confirm every answer before publishing.');

    const questions: Question[] = [];
    for (const [index, raw] of extraction.questions.entries()) {
      try {
        const pageValue = typeof raw.sourcePage === 'number' ? Math.trunc(raw.sourcePage) : null;
        const sourcePage = pageValue && pageValue > 0 && pageValue <= questionPdf.pageCount ? pageValue : null;
        const correctAnswers = Array.isArray(raw.correctAnswers)
          ? raw.correctAnswers.map(String).filter(Boolean)
          : [];
        if (correctAnswers.length === 0) {
          correctAnswers.push('REVIEW_REQUIRED');
          warnings.push(`Question ${index + 1} has no reliable answer and must be corrected.`);
        }
        questions.push(questionSchema.parse({
          id: randomUUID(),
          position: typeof raw.position === 'number' ? Math.max(1, Math.trunc(raw.position)) : index + 1,
          type: raw.type,
          stem: String(raw.stem ?? '').trim(),
          options: Array.isArray(raw.options) ? raw.options.map(String) : [],
          correctAnswers,
          marks: typeof raw.marks === 'number' && raw.marks > 0 ? raw.marks : 1,
          negativeMarks: typeof raw.negativeMarks === 'number' && raw.negativeMarks >= 0 ? raw.negativeMarks : 0,
          explanation: String(raw.explanation ?? ''),
          sourcePage,
          sourceImageUrl: sourcePage ? questionPdf.pages[sourcePage - 1]?.imageUrl ?? null : null,
        }));
      } catch (error) {
        warnings.push(`Question ${index + 1} could not be structured: ${error instanceof Error ? error.message : 'invalid data'}`);
      }
    }

    return this.data.saveTest({
      title: request.title,
      durationMinutes: request.durationMinutes,
      status: 'draft',
      sourcePdfUrl: questionPdf.sourceUrl,
      answerPdfUrl: answerPdf?.sourceUrl ?? null,
      sourceHash: questionPdf.hash,
      answerHash: answerPdf?.hash ?? null,
      questions: questions.sort((a, b) => a.position - b.position),
      warnings,
    });
  }

  async importDocument(embeddingModel: string) {
    if (!embeddingModel.trim()) throw new Error('Select an embedding model first.');
    const sourcePath = await this.pdf.choosePdf('Choose a study document PDF');
    if (!sourcePath) throw new Error('Document import cancelled.');
    const processed = await this.pdf.processPdf(sourcePath, 'documents');
    const duplicate = (await this.data.listDocuments()).find((document) => document.sourceHash === processed.hash);
    if (duplicate) {
      await this.pdf.discard(processed);
      throw new Error(`This document is already indexed as “${duplicate.name}”.`);
    }
    const rawChunks = PdfService.chunkPages(processed);
    if (rawChunks.length === 0) {
      await this.pdf.discard(processed);
      throw new Error('No searchable text was found in this PDF. Use a searchable/OCR PDF and try again.');
    }
    try {
      const chunks: SourceDocument['chunks'] = [];
      for (let offset = 0; offset < rawChunks.length; offset += 16) {
        const batch = rawChunks.slice(offset, offset + 16);
        const embeddings = await this.ollama.embed(embeddingModel, batch.map((chunk) => chunk.text));
        batch.forEach((chunk, index) => chunks.push({ ...chunk, embedding: embeddings[index] }));
      }
      return await this.data.saveDocument(sourceDocumentSchema.parse({
        id: processed.id,
        name: processed.name,
        sourcePdfUrl: processed.sourceUrl,
        sourceHash: processed.hash,
        pageCount: processed.pageCount,
        embeddingModel,
        chunks,
        createdAt: new Date().toISOString(),
      }));
    } catch (error) {
      await this.pdf.discard(processed);
      throw error;
    }
  }

  async deleteDocument(id: string) {
    const document = (await this.data.listDocuments()).find((item) => item.id === id);
    if (!document) return;
    await this.pdf.discardByAssetUrl(document.sourcePdfUrl);
    await this.data.deleteDocument(id);
  }

  async chat(
    input: TutorChatRequest,
    emit: (event: TutorStreamEvent) => void,
    signal?: AbortSignal,
  ) {
    const request = tutorChatRequestSchema.parse(input);
    const now = new Date().toISOString();
    const existing = request.threadId ? await this.data.getThread(request.threadId) : null;
    if (request.threadId && !existing) throw new Error('The selected conversation no longer exists.');
    const threadId = existing?.id ?? randomUUID();
    emit({ requestId: request.requestId, type: 'start', threadId });

    const citations: TutorMessage['citations'] = [];
    let systemPrompt = `You are a careful GATE exam tutor. Explain concepts clearly, show steps for calculations,
state assumptions, and admit uncertainty. Do not claim that generated material is an official answer key.`;

    if (request.mode === 'documents') {
      const allDocuments = await this.data.listDocuments();
      const selected = allDocuments.filter((document) => request.documentIds.includes(document.id));
      if (selected.length === 0) throw new Error('Select at least one indexed document for document-grounded mode.');
      const queryByModel = new Map<string, number[]>();
      for (const model of new Set(selected.map((document) => document.embeddingModel))) {
        queryByModel.set(model, (await this.ollama.embed(model, [request.content]))[0]);
      }
      const ranked = selected
        .flatMap((document) =>
          document.chunks.map((chunk) => ({
            document,
            chunk,
            score: cosineSimilarity(queryByModel.get(document.embeddingModel) ?? [], chunk.embedding),
          })),
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, 6);
      const context = ranked
        .map(({ document, chunk }, index) => {
          citations.push({ documentName: document.name, page: chunk.page });
          return `[SOURCE ${index + 1}: ${document.name}, page ${chunk.page}]\n${chunk.text}`;
        })
        .join('\n\n');
      systemPrompt += `\nAnswer using only the sources below. If they do not contain the answer, say so. Cite sources as [Source N].\n\n${context}`;
    }

    const priorMessages = (existing?.messages ?? []).slice(-12).map((message) => ({
      role: message.role,
      content: message.content,
    }));
    let assistantContent = '';
    for await (const chunk of this.ollama.streamChat(
      request.model,
      [{ role: 'system', content: systemPrompt }, ...priorMessages, { role: 'user', content: request.content }],
      signal,
    )) {
      assistantContent += chunk;
      emit({ requestId: request.requestId, type: 'chunk', content: chunk });
    }
    if (!assistantContent.trim()) throw new Error('The model completed without returning an answer.');

    const userMessage: TutorMessage = {
      id: randomUUID(), role: 'user', content: request.content, citations: [], createdAt: now,
    };
    const assistantMessage: TutorMessage = {
      id: randomUUID(), role: 'assistant', content: assistantContent, citations, createdAt: new Date().toISOString(),
    };
    const thread = tutorThreadSchema.parse({
      id: threadId,
      title: existing?.title ?? request.content.slice(0, 70),
      mode: request.mode,
      model: request.model,
      messages: [...(existing?.messages ?? []), userMessage, assistantMessage],
      createdAt: existing?.createdAt ?? now,
      updatedAt: assistantMessage.createdAt,
    });
    await this.data.saveThread(thread);
    emit({ requestId: request.requestId, type: 'done', thread });
  }
}
