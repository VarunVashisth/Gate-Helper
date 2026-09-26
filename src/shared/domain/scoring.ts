import type { Question } from '../contracts/api';

export type QuestionScore = {
  questionId: string;
  status: 'correct' | 'incorrect' | 'unattempted';
  awarded: number;
};

const normalizeText = (value: string) => value.trim().toLowerCase();

const isNumericAnswerCorrect = (answer: string, accepted: string[]) => {
  const numericAnswer = Number(answer.trim());
  if (!Number.isFinite(numericAnswer)) return false;
  return accepted.some((entry) => {
    const [startText, endText] = entry.split(':').map((part) => part.trim());
    const start = Number(startText);
    const end = endText === undefined ? start : Number(endText);
    if (!Number.isFinite(start) || !Number.isFinite(end)) return false;
    const epsilon = 1e-6;
    return numericAnswer >= Math.min(start, end) - epsilon && numericAnswer <= Math.max(start, end) + epsilon;
  });
};

export const scoreQuestion = (question: Question, answers: string[]): QuestionScore => {
  const attempted = answers.map(normalizeText).filter(Boolean);
  if (attempted.length === 0) {
    return { questionId: question.id, status: 'unattempted', awarded: 0 };
  }

  const correct = question.type === 'NAT'
    ? isNumericAnswerCorrect(attempted[0], question.correctAnswers)
    : (() => {
    const expected = [...new Set(question.correctAnswers.map(normalizeText))].sort();
    const actual = [...new Set(attempted)].sort();
    return expected.length === actual.length && expected.every((value, index) => value === actual[index]);
  })();

  return {
    questionId: question.id,
    status: correct ? 'correct' : 'incorrect',
    awarded: correct ? question.marks : -question.negativeMarks,
  };
};

export const scoreAttempt = (questions: Question[], answers: Record<string, string[]>) => {
  const details = questions.map((question) => scoreQuestion(question, answers[question.id] ?? []));
  return {
    score: Number(details.reduce((total, detail) => total + detail.awarded, 0).toFixed(4)),
    correct: details.filter((detail) => detail.status === 'correct').length,
    incorrect: details.filter((detail) => detail.status === 'incorrect').length,
    unattempted: details.filter((detail) => detail.status === 'unattempted').length,
    details,
  };
};
