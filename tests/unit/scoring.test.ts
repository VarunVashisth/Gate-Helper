import { describe, expect, it } from 'vitest';
import type { Question } from '../../src/shared/contracts/api';
import { scoreAttempt, scoreQuestion } from '../../src/shared/domain/scoring';

const question = (overrides: Partial<Question> = {}): Question => ({
  id: 'question-1', position: 1, type: 'MCQ', stem: 'Question', options: ['A', 'B'],
  correctAnswers: ['A'], marks: 2, negativeMarks: 0.66, explanation: '', sourcePage: null,
  sourceImageUrl: null, ...overrides,
});

describe('GATE scoring', () => {
  it('awards positive and negative marks without penalizing unattempted questions', () => {
    expect(scoreQuestion(question(), ['A']).awarded).toBe(2);
    expect(scoreQuestion(question(), ['B']).awarded).toBe(-0.66);
    expect(scoreQuestion(question(), []).awarded).toBe(0);
  });

  it('requires an exact MSQ set regardless of answer order', () => {
    const msq = question({ type: 'MSQ', correctAnswers: ['A', 'C'], options: ['A', 'B', 'C'], negativeMarks: 0 });
    expect(scoreQuestion(msq, ['C', 'A']).status).toBe('correct');
    expect(scoreQuestion(msq, ['A']).status).toBe('incorrect');
  });

  it('accepts numerical answers inside configured ranges', () => {
    const nat = question({ type: 'NAT', options: [], correctAnswers: ['1.49:1.51'] });
    expect(scoreQuestion(nat, ['1.5']).status).toBe('correct');
    expect(scoreQuestion(nat, ['1.6']).status).toBe('incorrect');
  });

  it('returns stable aggregate counts and rounded score', () => {
    const result = scoreAttempt([question(), question({ id: 'question-2', position: 2 })], {
      'question-1': ['A'], 'question-2': ['B'],
    });
    expect(result).toMatchObject({ score: 1.34, correct: 1, incorrect: 1, unattempted: 0 });
  });
});

