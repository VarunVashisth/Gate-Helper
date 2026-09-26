import { CalendarPlus, CheckCircle2, Clock3, Target, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { StudyTaskInput } from '../../shared/contracts/api';
import { useToastStore } from '../components/feedback/Toast';
import { Dialog } from '../components/ui/Dialog';
import { ErrorState, LoadingState } from '../components/ui/AsyncState';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';

const today = () => new Date().toISOString().slice(0, 10);

export function PlannerPage() {
  const tasks = useAsyncData(() => window.gateHelper.planner.list(), []);
  const pushToast = useToastStore((state) => state.push);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [form, setForm] = useState<StudyTaskInput>({
    title: '', description: '', scheduledDate: today(), durationMinutes: 60, kind: 'study', topicId: null,
  });
  const sorted = useMemo(
    () => [...(tasks.data ?? [])].sort((a, b) => a.scheduledDate.localeCompare(b.scheduledDate)),
    [tasks.data],
  );
  const completed = sorted.filter((task) => task.completed).length;
  const minutes = sorted.reduce((total, task) => total + task.durationMinutes, 0);

  const createTask = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setFormError('');
    try {
      await window.gateHelper.planner.create(form);
      setDialogOpen(false);
      setForm({ title: '', description: '', scheduledDate: today(), durationMinutes: 60, kind: 'study', topicId: null });
      await tasks.refresh();
      pushToast('Study task created.');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : 'Could not create the task.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Study Planner"
        title="Make each week intentional."
        description="Plan focused study, revision, and test sessions. Everything is saved locally and remains available after restart."
        action={<button className="button button--primary" onClick={() => setDialogOpen(true)}><CalendarPlus size={16} /> Add study task</button>}
      />
      <div className="metric-strip">
        <div><Target size={18} /><span><strong>{sorted.filter((task) => !task.completed).length} open tasks</strong><small>Remaining in your plan</small></span></div>
        <div><Clock3 size={18} /><span><strong>{Math.round(minutes / 60 * 10) / 10} planned hours</strong><small>Across all sessions</small></span></div>
        <div><CheckCircle2 size={18} /><span><strong>{completed} completed</strong><small>Finished study sessions</small></span></div>
      </div>

      {tasks.loading ? <LoadingState label="Loading your study plan…" /> : tasks.error ? (
        <ErrorState message={tasks.error} retry={() => void tasks.refresh()} />
      ) : sorted.length === 0 ? (
        <EmptyState icon={CalendarPlus} eyebrow="Your plan is empty" title="Create your first study session."
          description="Schedule a topic, revision block, or mock test and mark it complete when you finish." />
      ) : (
        <section className="item-list" aria-label="Study tasks">
          {sorted.map((task) => (
            <article className={`list-row${task.completed ? ' list-row--completed' : ''}`} key={task.id}>
              <label className="check-control">
                <input type="checkbox" checked={task.completed} onChange={async (event) => {
                  await window.gateHelper.planner.toggle(task.id, event.target.checked);
                  await tasks.refresh();
                }} />
                <span />
              </label>
              <div className="list-row__body">
                <div><strong>{task.title}</strong><span className={`kind-badge kind-badge--${task.kind}`}>{task.kind}</span></div>
                <p>{task.description || 'No notes for this session.'}</p>
              </div>
              <div className="list-row__meta"><strong>{new Date(`${task.scheduledDate}T00:00:00`).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</strong><span>{task.durationMinutes} min</span></div>
              <button className="icon-button" aria-label={`Delete ${task.title}`} onClick={async () => {
                await window.gateHelper.planner.delete(task.id);
                await tasks.refresh();
                pushToast('Study task deleted.');
              }}><Trash2 size={16} /></button>
            </article>
          ))}
        </section>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title="Add a study task" description="Keep sessions specific and realistically sized.">
        <form className="form-stack" onSubmit={createTask}>
          <label><span>Task title</span><input required maxLength={200} autoFocus value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="Revise graph algorithms" /></label>
          <label><span>Notes</span><textarea maxLength={2000} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Optional focus or resources" /></label>
          <div className="form-grid">
            <label><span>Date</span><input required type="date" value={form.scheduledDate} onChange={(e) => setForm({ ...form, scheduledDate: e.target.value })} /></label>
            <label><span>Duration</span><input required type="number" min="5" max="720" value={form.durationMinutes} onChange={(e) => setForm({ ...form, durationMinutes: Number(e.target.value) })} /></label>
            <label><span>Session type</span><select value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as StudyTaskInput['kind'] })}><option value="study">Study</option><option value="revision">Revision</option><option value="test">Test</option></select></label>
          </div>
          {formError && <p className="form-error" role="alert">{formError}</p>}
          <div className="dialog__actions"><button type="button" className="button button--secondary" onClick={() => setDialogOpen(false)}>Cancel</button><button className="button button--primary" disabled={saving}>{saving ? 'Saving…' : 'Create task'}</button></div>
        </form>
      </Dialog>
    </div>
  );
}

