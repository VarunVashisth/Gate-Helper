import { ollamaStatusSchema, type OllamaStatus } from '../../../shared/contracts/api';

const OLLAMA_TAGS_URL = 'http://127.0.0.1:11434/api/tags';

type OllamaTagsResponse = {
  models?: Array<{
    name?: string;
    size?: number;
    details?: {
      parameter_size?: string;
      quantization_level?: string;
    };
  }>;
};

export class OllamaService {
  async getStatus(): Promise<OllamaStatus> {
    const checkedAt = new Date().toISOString();
    try {
      const response = await fetch(OLLAMA_TAGS_URL, {
        signal: AbortSignal.timeout(2500),
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Ollama returned HTTP ${response.status}.`);

      const body = (await response.json()) as OllamaTagsResponse;
      const models = (body.models ?? [])
        .filter((model) => typeof model.name === 'string')
        .map((model) => ({
          name: model.name as string,
          size: typeof model.size === 'number' ? model.size : 0,
          parameterSize: model.details?.parameter_size ?? null,
          quantization: model.details?.quantization_level ?? null,
        }));

      if (models.length === 0) {
        return ollamaStatusSchema.parse({
          state: 'no-models',
          message: 'Ollama is running, but no local models are installed.',
          models,
          checkedAt,
        });
      }

      return ollamaStatusSchema.parse({
        state: 'ready',
        message: `${models.length} local model${models.length === 1 ? '' : 's'} available.`,
        models,
        checkedAt,
      });
    } catch {
      return ollamaStatusSchema.parse({
        state: 'unavailable',
        message: 'Ollama is not reachable on this computer.',
        models: [],
        checkedAt,
      });
    }
  }

  async generateStructuredQuestions(model: string, questionText: string, answerText: string) {
    const status = await this.getStatus();
    if (status.state !== 'ready' || !status.models.some((item) => item.name === model)) {
      throw new Error(`The selected Ollama model "${model}" is not installed or Ollama is unavailable.`);
    }
    const schema = {
      type: 'object',
      required: ['questions', 'warnings'],
      properties: {
        questions: {
          type: 'array',
          items: {
            type: 'object',
            required: ['position', 'type', 'stem', 'options', 'correctAnswers', 'marks', 'negativeMarks', 'sourcePage'],
            properties: {
              position: { type: 'integer' },
              type: { type: 'string', enum: ['MCQ', 'MSQ', 'NAT'] },
              stem: { type: 'string' },
              options: { type: 'array', items: { type: 'string' } },
              correctAnswers: { type: 'array', items: { type: 'string' } },
              marks: { type: 'number' },
              negativeMarks: { type: 'number' },
              explanation: { type: 'string' },
              sourcePage: { type: ['integer', 'null'] },
            },
          },
        },
        warnings: { type: 'array', items: { type: 'string' } },
      },
    };
    const prompt = `Convert the supplied GATE-style question paper into structured data.
Preserve mathematical notation in Markdown/LaTeX, question order, options, marks and source page markers.
Map the answer key carefully. Never invent a missing answer. Add a warning for ambiguity.
For source pages, text begins with markers such as [PAGE 3].

QUESTION PAPER:
${questionText.slice(0, 180_000)}

ANSWER KEY:
${answerText.slice(0, 80_000) || 'No answer key was supplied.'}`;
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10 * 60_000),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        format: schema,
        messages: [
          { role: 'system', content: 'You are a precise exam-paper transcription engine. Return only schema-valid data.' },
          { role: 'user', content: prompt },
        ],
        options: { temperature: 0 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama extraction failed with HTTP ${response.status}.`);
    const body = (await response.json()) as { message?: { content?: string } };
    if (!body.message?.content) throw new Error('Ollama returned an empty extraction response.');
    try {
      return JSON.parse(body.message.content) as { questions: Array<Record<string, unknown>>; warnings: string[] };
    } catch {
      throw new Error('Ollama returned malformed structured data. Try another model or review the PDF text quality.');
    }
  }

  async transcribePage(model: string, imageBase64: string, pageNumber: number) {
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5 * 60_000),
      body: JSON.stringify({
        model,
        stream: false,
        think: false,
        messages: [{
          role: 'user',
          content: `Faithfully transcribe page ${pageNumber} of this exam document. Preserve question numbers, choices, mathematical expressions in LaTeX, tables, and answer-key entries. Do not solve questions or add missing text. Return transcription only.`,
          images: [imageBase64],
        }],
        options: { temperature: 0 },
      }),
    });
    if (!response.ok) throw new Error(`Ollama OCR failed with HTTP ${response.status}.`);
    const body = (await response.json()) as { message?: { content?: string } };
    const content = body.message?.content?.trim();
    if (!content) throw new Error('The selected model returned no OCR text. It may not support images.');
    return content;
  }

  async embed(model: string, inputs: string[]) {
    const response = await fetch('http://127.0.0.1:11434/api/embed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5 * 60_000),
      body: JSON.stringify({ model, input: inputs }),
    });
    if (!response.ok) throw new Error(`Ollama embedding failed with HTTP ${response.status}.`);
    const body = (await response.json()) as { embeddings?: number[][] };
    if (!body.embeddings || body.embeddings.length !== inputs.length) {
      throw new Error('Ollama returned an invalid embedding response.');
    }
    return body.embeddings;
  }

  async *streamChat(
    model: string,
    messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }>,
    signal?: AbortSignal,
  ) {
    const timeoutSignal = AbortSignal.timeout(10 * 60_000);
    const requestSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
    const response = await fetch('http://127.0.0.1:11434/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: requestSignal,
      body: JSON.stringify({ model, messages, stream: true }),
    });
    if (!response.ok || !response.body) throw new Error(`Ollama chat failed with HTTP ${response.status}.`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffered = '';
    while (true) {
      const { value, done } = await reader.read();
      buffered += decoder.decode(value, { stream: !done });
      const lines = buffered.split('\n');
      buffered = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.trim()) continue;
        const event = JSON.parse(line) as { message?: { content?: string }; error?: string };
        if (event.error) throw new Error(event.error);
        if (event.message?.content) yield event.message.content;
      }
      if (done) break;
    }
    if (buffered.trim()) {
      const event = JSON.parse(buffered) as { message?: { content?: string }; error?: string };
      if (event.error) throw new Error(event.error);
      if (event.message?.content) yield event.message.content;
    }
  }
}
