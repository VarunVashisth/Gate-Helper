import { BarChart3, CheckCircle2, Clock3, Crosshair, RotateCcw, XCircle } from 'lucide-react';
import { useMemo, useState } from 'react';
import { ErrorState, LoadingState } from '../components/ui/AsyncState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { scoreQuestion } from '../../shared/domain/scoring';

export function ResultsPage() {
  const attempts = useAsyncData(() => window.gateHelper.attempts.list(), []);
  const completed = useMemo(() => (attempts.data ?? []).filter((item) => item.status === 'submitted'), [attempts.data]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = completed.find((attempt) => attempt.id === selectedId) ?? completed[0];

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Results & Review" title="Make every attempt useful." description="Review scores, accuracy, timing, and every answer from the exact test snapshot you attempted." />
      {attempts.loading ? <LoadingState label="Loading results…" /> : attempts.error ? <ErrorState message={attempts.error} retry={() => void attempts.refresh()} /> : completed.length === 0 ? <EmptyState icon={BarChart3} eyebrow="No completed attempts" title="Results will appear after your first test." description="Complete a published test to generate a score and question-by-question review." /> : <>
        <section className="result-tabs">{completed.map((attempt) => <button className={selected?.id === attempt.id ? 'result-tab result-tab--active' : 'result-tab'} key={attempt.id} onClick={() => setSelectedId(attempt.id)}><strong>{attempt.testTitle}</strong><span>{new Date(attempt.submittedAt ?? attempt.startedAt).toLocaleDateString('en-IN')}</span></button>)}</section>
        {selected && <>
          <section className="result-hero"><div><p className="eyebrow">Final score</p><strong>{selected.score}</strong><span>/ {selected.snapshot.questions.reduce((sum, question) => sum + question.marks, 0)} marks</span></div><div><Crosshair size={18} /><strong>{selected.snapshot.questions.length ? Math.round((selected.correct / selected.snapshot.questions.length) * 100) : 0}%</strong><span>accuracy</span></div><div><Clock3 size={18} /><strong>{Math.round(selected.durationSeconds / 60)} min</strong><span>time used</span></div></section>
          <div className="insight-preview"><div><CheckCircle2 size={19} /><span><strong>{selected.correct} correct</strong><small>Full marks awarded</small></span></div><div><XCircle size={19} /><span><strong>{selected.incorrect} incorrect</strong><small>Negative marking applied</small></span></div><div><RotateCcw size={19} /><span><strong>{selected.unattempted} unattempted</strong><small>No marks changed</small></span></div></div>
          <section className="review-list">{selected.snapshot.questions.map((question) => { const detail = scoreQuestion(question, selected.answers[question.id] ?? []); return <article key={question.id} className={`review-item review-item--${detail.status}`}><span>{question.position}</span><div><strong>{question.stem}</strong><p>Your answer: {(selected.answers[question.id] ?? []).join(', ') || 'Unattempted'} · Correct: {question.correctAnswers.join(', ')}</p>{question.explanation && <p className="explanation">{question.explanation}</p>}</div><b>{detail.awarded > 0 ? '+' : ''}{detail.awarded}</b></article>; })}</section>
        </>}
      </>}
    </div>
  );
}
