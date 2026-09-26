import { AlertTriangle, ArrowLeft, Eye, FileText, Plus, Save, Send, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { Question, TestPaperInput } from '../../shared/contracts/api';
import { useToastStore } from '../components/feedback/Toast';
import { Dialog } from '../components/ui/Dialog';
import { ErrorState, LoadingState } from '../components/ui/AsyncState';
import { PageHeader } from '../components/ui/PageHeader';

const emptyQuestion = (position: number): Question => ({
  id: crypto.randomUUID(), position, type: 'MCQ', stem: '', options: ['', '', '', ''], correctAnswers: [], marks: 1, negativeMarks: 0.33, explanation: '', sourcePage: null, sourceImageUrl: null,
});

export function TestEditorPage() {
  const { testId } = useParams();
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);
  const [loading, setLoading] = useState(Boolean(testId));
  const [error, setError] = useState('');
  const [questionOpen, setQuestionOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [question, setQuestion] = useState<Question>(emptyQuestion(1));
  const [test, setTest] = useState<TestPaperInput & { id?: string }>({
    title: '', durationMinutes: 180, status: 'draft', sourcePdfUrl: null, answerPdfUrl: null,
    sourceHash: null, answerHash: null, questions: [], warnings: [],
  });

  useEffect(() => {
    if (!testId) return;
    void window.gateHelper.tests.get(testId).then((value) => {
      if (!value) setError('Test not found.');
      else setTest(value);
    }).catch((cause: unknown) => setError(cause instanceof Error ? cause.message : 'Could not load test.')).finally(() => setLoading(false));
  }, [testId]);

  const save = async (status: 'draft' | 'published') => {
    setError('');
    try {
      const saved = await window.gateHelper.tests.save({ ...test, status });
      setTest(saved);
      pushToast(status === 'published' ? 'Test published and ready to attempt.' : 'Draft saved.');
      if (!testId) navigate(`/tests/${saved.id}/edit`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not save test.');
    }
  };

  if (loading) return <LoadingState label="Loading test draft…" />;
  if (error && !test.title && testId) return <ErrorState message={error} retry={() => navigate('/tests')} />;

  return (
    <div className="page-stack">
      <button className="back-link" onClick={() => navigate('/tests')}><ArrowLeft size={15} /> Back to tests</button>
      <PageHeader eyebrow={test.status === 'published' ? 'Published test' : 'Review draft'} title={test.title || 'New manual test'}
        description="Verify every question and answer. Publishing locks new attempts to a snapshot of this version."
        action={<div className="button-group"><button className="button button--secondary" onClick={() => void save('draft')}><Save size={15} /> Save draft</button><button className="button button--primary" onClick={() => void save('published')}><Send size={15} /> Publish</button></div>} />
      {test.warnings.length > 0 && <section className="warning-panel"><AlertTriangle size={19} /><div><strong>Review warnings</strong>{test.warnings.map((warning, index) => <p key={`${warning}-${index}`}>{warning}</p>)}</div></section>}
      <section className="editor-card form-stack">
        <div className="form-grid"><label><span>Test title</span><input required maxLength={240} value={test.title} onChange={(e) => setTest({ ...test, title: e.target.value })} placeholder="Full-length mock test 1" /></label><label><span>Duration in minutes</span><input type="number" min="1" max="600" value={test.durationMinutes} onChange={(e) => setTest({ ...test, durationMinutes: Number(e.target.value) })} placeholder="180" /></label></div>
        <div className="source-links">{test.sourcePdfUrl && <a className="button button--secondary" href={test.sourcePdfUrl} target="_blank" rel="noreferrer"><Eye size={14} /> Original question PDF</a>}{test.answerPdfUrl && <a className="button button--secondary" href={test.answerPdfUrl} target="_blank" rel="noreferrer"><Eye size={14} /> Original answer key</a>}</div>
      </section>
      <div className="section-heading"><div><p className="eyebrow">Question review</p><h2>{test.questions.length} questions</h2></div><button className="button button--primary" onClick={() => { setEditingIndex(null); setQuestion(emptyQuestion(test.questions.length + 1)); setQuestionOpen(true); }}><Plus size={15} /> Add question</button></div>
      {test.questions.length === 0 ? <div className="editor-empty"><FileText size={25} /><strong>No valid questions yet</strong><p>Add questions manually or check the extraction warnings.</p></div> : <section className="question-review-list">{test.questions.map((item, index) => <article key={item.id}><div className="question-number">{item.position}</div><div><span className="kind-badge">{item.type} · {item.marks} mark{item.marks === 1 ? '' : 's'}</span><h3>{item.stem}</h3><p>Answer: {item.correctAnswers.join(', ')}</p></div><div className="question-actions"><button className="icon-button" aria-label={`Edit question ${item.position}`} onClick={() => { setEditingIndex(index); setQuestion(structuredClone(item)); setQuestionOpen(true); }}><Eye size={16} /></button><button className="icon-button" aria-label={`Delete question ${item.position}`} onClick={() => setTest({ ...test, questions: test.questions.filter((_, itemIndex) => itemIndex !== index).map((value, position) => ({ ...value, position: position + 1 })) })}><Trash2 size={16} /></button></div></article>)}</section>}
      {error && <p className="form-error" role="alert">{error}</p>}

      <Dialog open={questionOpen} onClose={() => setQuestionOpen(false)} title={editingIndex === null ? 'Add question' : `Review question ${question.position}`} description="Answers use option text for MCQ/MSQ and an exact value or min:max range for NAT.">
        <form className="form-stack" onSubmit={(event) => { event.preventDefault(); const next = [...test.questions]; if (editingIndex === null) next.push(question); else next[editingIndex] = question; setTest({ ...test, questions: next }); setQuestionOpen(false); }}>
          <div className="form-grid"><label><span>Type</span><select value={question.type} onChange={(e) => setQuestion({ ...question, type: e.target.value as Question['type'], options: e.target.value === 'NAT' ? [] : question.options })}><option>MCQ</option><option>MSQ</option><option>NAT</option></select></label><label><span>Source page</span><input type="number" min="1" value={question.sourcePage ?? ''} onChange={(e) => setQuestion({ ...question, sourcePage: e.target.value ? Number(e.target.value) : null })} /></label></div>
          <label><span>Question</span><textarea required rows={5} value={question.stem} onChange={(e) => setQuestion({ ...question, stem: e.target.value })} placeholder="Enter the complete question, including formulas and conditions" /></label>
          {question.type !== 'NAT' && <label><span>Options, one per line</span><textarea required rows={5} value={question.options.join('\n')} onChange={(e) => setQuestion({ ...question, options: e.target.value.split('\n').filter(Boolean) })} placeholder={'Option A\nOption B\nOption C\nOption D'} /></label>}
          <label><span>Correct answer{question.type === 'MSQ' ? 's, one per line' : ''}</span><textarea required rows={question.type === 'MSQ' ? 3 : 1} value={question.correctAnswers.join('\n')} onChange={(e) => setQuestion({ ...question, correctAnswers: e.target.value.split('\n').map((value) => value.trim()).filter(Boolean) })} placeholder={question.type === 'NAT' ? '42 or 41.5:42.5 for a range' : 'Paste the exact option text'} /></label>
          <div className="form-grid"><label><span>Positive marks</span><input type="number" min="0.1" step="0.01" value={question.marks} onChange={(e) => setQuestion({ ...question, marks: Number(e.target.value) })} /></label><label><span>Negative marks</span><input type="number" min="0" step="0.01" value={question.negativeMarks} onChange={(e) => setQuestion({ ...question, negativeMarks: Number(e.target.value) })} /></label></div>
          <label><span>Explanation</span><textarea rows={3} value={question.explanation} onChange={(e) => setQuestion({ ...question, explanation: e.target.value })} placeholder="Optional worked solution or review note" /></label>
          {question.sourceImageUrl && <img className="source-preview" src={question.sourceImageUrl} alt={`Original PDF page ${question.sourcePage}`} />}
          <div className="dialog__actions"><button type="button" className="button button--secondary" onClick={() => setQuestionOpen(false)}>Cancel</button><button className="button button--primary">Keep question</button></div>
        </form>
      </Dialog>
    </div>
  );
}
