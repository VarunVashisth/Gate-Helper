import { AlertTriangle, ArrowLeft, Bookmark, CheckCircle2, Clock3, Eye, Flag, Send } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Attempt } from '../../shared/contracts/api';
import { ErrorState, LoadingState } from '../components/ui/AsyncState';
import { ScientificCalculator } from '../components/exam/ScientificCalculator';

const formatTime = (seconds: number) => `${Math.floor(seconds / 60).toString().padStart(2, '0')}:${(seconds % 60).toString().padStart(2, '0')}`;

export function TestRunnerPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();
  const [attempt, setAttempt] = useState<Attempt | null>(null);
  const [error, setError] = useState('');
  const [currentIndex, setCurrentIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string[]>>({});
  const [spentSeconds, setSpentSeconds] = useState(0);
  const [showSource, setShowSource] = useState(false);
  const submitting = useRef(false);
  const answersRef = useRef(answers);
  const spentSecondsRef = useRef(spentSeconds);
  const submitRef = useRef<(confirmSubmission: boolean) => Promise<void>>(async () => undefined);
  useEffect(() => { answersRef.current = answers; }, [answers]);
  useEffect(() => { spentSecondsRef.current = spentSeconds; }, [spentSeconds]);

  useEffect(() => {
    void window.gateHelper.attempts.list().then((items) => {
      const value = items.find((item) => item.id === attemptId);
      if (!value) setError('Attempt not found.');
      else if (value.status === 'submitted') navigate('/results', { replace: true });
      else { setAttempt(value); setAnswers(value.answers); setSpentSeconds(value.durationSeconds); }
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load attempt.'));
  }, [attemptId, navigate]);

  const remaining = Math.max(0, (attempt?.snapshot.durationMinutes ?? 0) * 60 - spentSeconds);
  const submit = useCallback(async (confirmSubmission: boolean) => {
    if (!attempt || submitting.current) return;
    if (confirmSubmission && !confirm('Submit this test? You will not be able to change your answers.')) return;
    submitting.current = true;
    try {
      await window.gateHelper.attempts.submit(attempt.id, answers, spentSeconds);
      navigate('/results');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not submit the attempt.');
      submitting.current = false;
    }
  }, [answers, attempt, navigate, spentSeconds]);
  useEffect(() => { submitRef.current = submit; }, [submit]);

  useEffect(() => {
    if (!attempt) return;
    const totalSeconds = attempt.snapshot.durationMinutes * 60;
    const timer = window.setInterval(() => setSpentSeconds((value) => {
      const next = value + 1;
      if (next >= totalSeconds) queueMicrotask(() => void submitRef.current(false));
      return next;
    }), 1000);
    return () => window.clearInterval(timer);
  }, [attempt]);

  useEffect(() => {
    if (!attempt) return;
    const autosave = window.setInterval(() => {
      void window.gateHelper.attempts.saveAnswers(attempt.id, answersRef.current, spentSecondsRef.current).catch(() => undefined);
    }, 5000);
    return () => window.clearInterval(autosave);
  }, [attempt]);

  const exitAttempt = async () => {
    if (!attempt) return;
    try {
      await window.gateHelper.attempts.saveAnswers(attempt.id, answersRef.current, spentSecondsRef.current);
      navigate('/tests');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save the attempt before exiting.');
    }
  };

  const question = attempt?.snapshot.questions[currentIndex];
  const answered = useMemo(() => Object.values(answers).filter((values) => values.some(Boolean)).length, [answers]);
  if (error && !attempt) return <ErrorState message={error} retry={() => navigate('/tests')} />;
  if (!attempt || !question) return <LoadingState label="Opening test attempt…" />;
  const currentAnswers = answers[question.id] ?? [];
  const choose = (value: string) => {
    if (question.type === 'MSQ') {
      const next = currentAnswers.includes(value) ? currentAnswers.filter((item) => item !== value) : [...currentAnswers, value];
      setAnswers({ ...answers, [question.id]: next });
    } else setAnswers({ ...answers, [question.id]: value ? [value] : [] });
  };

  return (
    <div className="exam-shell">
      <header className="exam-header"><button className="back-link" onClick={() => void exitAttempt()}><ArrowLeft size={15} /> Save & exit</button><div><strong>{attempt.testTitle}</strong><span>{question.type} · {question.marks} mark{question.marks === 1 ? '' : 's'}</span></div><ScientificCalculator /><div className={`exam-timer${remaining < 300 ? ' exam-timer--danger' : ''}`}><Clock3 size={16} /> {formatTime(remaining)}</div><button className="button button--primary" onClick={() => void submit(true)}><Send size={14} /> Submit</button></header>
      {error && <div className="exam-error"><AlertTriangle size={16} /> {error}</div>}
      <div className="exam-body">
        <main className="question-stage">
          <div className="question-stage__meta"><span>Question {currentIndex + 1} of {attempt.snapshot.questions.length}</span><span>+{question.marks} / -{question.negativeMarks}</span></div>
          <h1>{question.stem}</h1>
          {question.type === 'NAT' ? <label className="nat-answer"><span>Numerical answer</span><input inputMode="decimal" value={currentAnswers[0] ?? ''} onChange={(e) => choose(e.target.value)} placeholder="Enter a number" /></label> : <div className="answer-options">{question.options.map((option, index) => <label key={`${option}-${index}`} className={currentAnswers.includes(option) ? 'answer-option answer-option--selected' : 'answer-option'}><input type={question.type === 'MSQ' ? 'checkbox' : 'radio'} name={question.id} checked={currentAnswers.includes(option)} onChange={() => choose(option)} /><span>{String.fromCharCode(65 + index)}</span><p>{option}</p></label>)}</div>}
          {question.sourceImageUrl && <div className="source-toggle"><button className="button button--secondary" onClick={() => setShowSource((value) => !value)}><Eye size={15} /> {showSource ? 'Hide' : 'View'} original page</button>{showSource && <img className="source-page" src={question.sourceImageUrl} alt={`Source page ${question.sourcePage}`} />}</div>}
          <div className="question-footer"><button className="button button--secondary" disabled={currentIndex === 0} onClick={() => setCurrentIndex((index) => index - 1)}>Previous</button><button className="button button--primary" disabled={currentIndex === attempt.snapshot.questions.length - 1} onClick={() => setCurrentIndex((index) => index + 1)}>Save & next</button></div>
        </main>
        <aside className="question-palette"><div className="question-palette__summary"><strong>{answered}</strong><span>answered</span><strong>{attempt.snapshot.questions.length - answered}</strong><span>remaining</span></div><div className="palette-grid">{attempt.snapshot.questions.map((item, index) => <button key={item.id} className={`${index === currentIndex ? 'palette-current ' : ''}${answers[item.id]?.some(Boolean) ? 'palette-answered' : ''}`} onClick={() => setCurrentIndex(index)}>{index + 1}</button>)}</div><div className="palette-legend"><span><CheckCircle2 size={13} /> Answered</span><span><Flag size={13} /> Current</span><span><Bookmark size={13} /> Review later</span></div></aside>
      </div>
    </div>
  );
}
