import { Clock3, FileCheck2, FileUp, Pencil, Play, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useToastStore } from '../components/feedback/Toast';
import { ErrorState, LoadingState } from '../components/ui/AsyncState';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';
import { useOllamaStatus } from '../hooks/useOllamaStatus';

export function TestsPage() {
  const tests = useAsyncData(() => window.gateHelper.tests.list(), []);
  const ollama = useOllamaStatus();
  const navigate = useNavigate();
  const pushToast = useToastStore((state) => state.push);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState('');
  const [importForm, setImportForm] = useState({ title: '', durationMinutes: 180, model: '' });
  const models = ollama.data?.state === 'ready' ? ollama.data.models : [];
  const selectedModel = importForm.model || models.find((model) => model.name.includes('vl'))?.name || models[0]?.name || '';

  const importPaper = async (event: React.FormEvent) => {
    event.preventDefault();
    setImporting(true);
    setError('');
    try {
      const test = await window.gateHelper.tests.importPdf({ ...importForm, model: selectedModel });
      setImportOpen(false);
      pushToast('PDF extraction completed. Review the draft before publishing.');
      navigate(`/tests/${test.id}/edit`);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import the PDF.');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow="PYQs & Mock Tests" title="Practise under real exam conditions."
        description="Create tests manually or convert question and answer-key PDFs into review-gated drafts."
        action={<div className="button-group"><button className="button button--secondary" onClick={() => navigate('/tests/new')}><Plus size={16} /> Manual test</button><button className="button button--primary" onClick={() => setImportOpen(true)}><FileUp size={16} /> Import PDFs</button></div>} />

      <section className="workflow-steps" aria-label="Import workflow">
        <div><span>1</span><strong>Upload PDFs</strong><p>Question paper and optional answer key</p></div>
        <div><span>2</span><strong>Review extraction</strong><p>Confirm every question, visual, and answer</p></div>
        <div><span>3</span><strong>Publish & practise</strong><p>Attempts use immutable snapshots</p></div>
      </section>

      {tests.loading ? <LoadingState label="Loading test library…" /> : tests.error ? <ErrorState message={tests.error} retry={() => void tests.refresh()} /> : tests.data?.length === 0 ? (
        <EmptyState icon={FileCheck2} eyebrow="No tests in your library" title="Create or import your first paper."
          description="Imported questions remain drafts until you verify them. You can also build a paper manually."
          action={<span className="safety-note"><ShieldCheck size={15} /> Review required before PDF drafts can be published</span>} />
      ) : (
        <section className="card-list">
          {tests.data?.map((test) => (
            <article className="test-card" key={test.id}>
              <div className="test-card__status"><span className={`state-badge state-badge--${test.status}`}>{test.status}</span>{test.warnings.length > 0 && <span>{test.warnings.length} warning{test.warnings.length === 1 ? '' : 's'}</span>}</div>
              <h2>{test.title}</h2>
              <p><Clock3 size={14} /> {test.durationMinutes} minutes <span>•</span> {test.questions.length} questions <span>•</span> {test.questions.reduce((sum, question) => sum + question.marks, 0)} marks</p>
              <div className="test-card__actions">
                <button className="button button--secondary" onClick={() => navigate(`/tests/${test.id}/edit`)}><Pencil size={14} /> Review</button>
                {test.status === 'published' && <button className="button button--primary" onClick={async () => { try { const attempt = await window.gateHelper.attempts.start(test.id); navigate(`/attempt/${attempt.id}`); } catch (cause) { pushToast(cause instanceof Error ? cause.message : 'Could not start test.'); } }}><Play size={14} /> Start test</button>}
                <button className="icon-button" aria-label={`Delete ${test.title}`} onClick={async () => { if (!confirm(`Delete "${test.title}"?`)) return; try { await window.gateHelper.tests.delete(test.id); await tests.refresh(); } catch (cause) { pushToast(cause instanceof Error ? cause.message : 'Could not delete test.'); } }}><Trash2 size={15} /></button>
              </div>
            </article>
          ))}
        </section>
      )}

      <Dialog open={importOpen} onClose={() => !importing && setImportOpen(false)} title="Import a paper from PDFs" description="You will choose the question PDF first, then an optional answer key. Processing can take several minutes.">
        <form className="form-stack" onSubmit={importPaper}>
          <label><span>Test title</span><input required autoFocus maxLength={240} value={importForm.title} onChange={(e) => setImportForm({ ...importForm, title: e.target.value })} placeholder="GATE CS 2026 Set 1" /></label>
          <div className="form-grid"><label><span>Duration in minutes</span><input required type="number" min="1" max="600" value={importForm.durationMinutes} onChange={(e) => setImportForm({ ...importForm, durationMinutes: Number(e.target.value) })} placeholder="180" /></label><label><span>Vision-capable model</span><select required value={selectedModel} onChange={(e) => setImportForm({ ...importForm, model: e.target.value })}><option value="">Select model</option>{models.map((model) => <option key={model.name}>{model.name}</option>)}</select></label></div>
          {models.length === 0 && <p className="form-hint">Start Ollama and install a vision-capable model such as qwen3-vl:8b before importing.</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog__actions"><button type="button" className="button button--secondary" disabled={importing} onClick={() => setImportOpen(false)}>Cancel</button><button className="button button--primary" disabled={importing || !selectedModel}>{importing ? 'Extracting and structuring…' : 'Choose PDFs & import'}</button></div>
        </form>
      </Dialog>
    </div>
  );
}
