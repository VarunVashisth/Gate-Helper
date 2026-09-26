import { BookOpenCheck, CheckCircle2, Circle, Pencil, Plus, Search, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { SyllabusTopic, SyllabusTopicInput } from '../../shared/contracts/api';
import { useToastStore } from '../components/feedback/Toast';
import { ErrorState, LoadingState } from '../components/ui/AsyncState';
import { Dialog } from '../components/ui/Dialog';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { useAsyncData } from '../hooks/useAsyncData';

type Filter = 'all' | 'completed' | 'open';
const blankTopic = (): SyllabusTopicInput => ({ parentId: null, title: '', notes: '', targetDate: null, priority: 'normal', completed: false });

export function SyllabusPage() {
  const syllabus = useAsyncData(() => window.gateHelper.syllabus.get(), []);
  const pushToast = useToastStore((state) => state.push);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [paperDialogOpen, setPaperDialogOpen] = useState(false);
  const [topic, setTopic] = useState<SyllabusTopicInput>(blankTopic());
  const [paperName, setPaperName] = useState('');
  const [error, setError] = useState('');

  const topics = useMemo(() => syllabus.data?.topics ?? [], [syllabus.data?.topics]);
  const completedCount = topics.filter((item) => item.completed).length;
  const progress = topics.length ? Math.round((completedCount / topics.length) * 100) : 0;
  const depths = useMemo(() => {
    const result = new Map<string, number>();
    const depthOf = (item: SyllabusTopic, seen = new Set<string>()): number => {
      if (!item.parentId || seen.has(item.id)) return 0;
      const cached = result.get(item.id);
      if (cached !== undefined) return cached;
      const parent = topics.find((candidate) => candidate.id === item.parentId);
      const depth = parent ? Math.min(5, 1 + depthOf(parent, new Set([...seen, item.id]))) : 0;
      result.set(item.id, depth);
      return depth;
    };
    topics.forEach((item) => depthOf(item));
    return result;
  }, [topics]);
  const visibleTopics = topics.filter((item) => {
    const matchesSearch = `${item.title} ${item.notes}`.toLowerCase().includes(search.toLowerCase());
    return matchesSearch && (filter === 'all' || (filter === 'completed' ? item.completed : !item.completed));
  });

  const openTopic = (existing?: SyllabusTopic) => {
    setError('');
    setTopic(existing ? { ...existing } : blankTopic());
    setDialogOpen(true);
  };

  return (
    <div className="page-stack">
      <PageHeader eyebrow={syllabus.data?.paperName || 'Paper-neutral tracking'} title="See the whole syllabus clearly."
        description="Track nested topics, notes, deadlines, and priorities. Parent completion follows its subtopics automatically."
        action={<div className="button-group"><button className="button button--secondary" onClick={() => { setPaperName(syllabus.data?.paperName ?? ''); setPaperDialogOpen(true); }}><Pencil size={15} /> Paper</button><button className="button button--primary" onClick={() => openTopic()}><Plus size={16} /> Add topic</button></div>} />

      <section className="progress-card">
        <div><span>Overall completion</span><strong>{progress}%</strong></div>
        <div className="progress-track"><span style={{ width: `${progress}%` }} /></div>
        <p>{completedCount} of {topics.length} topics complete</p>
      </section>
      <div className="toolbar" aria-label="Syllabus filters">
        <label className="search-field"><Search size={17} /><input placeholder="Search topics" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search syllabus topics" /></label>
        <div className="segmented-control" aria-label="Completion filter">
          <button className={filter === 'all' ? 'segmented-control__active' : ''} onClick={() => setFilter('all')}>All</button>
          <button className={filter === 'completed' ? 'segmented-control__active' : ''} onClick={() => setFilter('completed')}><CheckCircle2 size={14} /> Completed</button>
          <button className={filter === 'open' ? 'segmented-control__active' : ''} onClick={() => setFilter('open')}><Circle size={14} /> Not completed</button>
        </div>
      </div>

      {syllabus.loading ? <LoadingState label="Loading syllabus…" /> : syllabus.error ? <ErrorState message={syllabus.error} retry={() => void syllabus.refresh()} /> : topics.length === 0 ? (
        <EmptyState icon={BookOpenCheck} eyebrow={syllabus.data?.paperName ? 'Ready for topics' : 'No paper selected'} title="Add your first syllabus topic."
          description="Start with sections, then add subtopics beneath them. Progress is calculated from everything you add." action={<button className="button button--primary" onClick={() => openTopic()}>Add first topic</button>} />
      ) : visibleTopics.length === 0 ? (
        <EmptyState icon={Search} title="No topics match this view." description="Change the search or completion filter to see more topics." compact />
      ) : (
        <section className="item-list syllabus-list">
          {visibleTopics.map((item) => (
            <article className={`list-row${item.completed ? ' list-row--completed' : ''}`} key={item.id} style={{ marginLeft: `${(depths.get(item.id) ?? 0) * 28}px` }}>
              <label className="check-control"><input type="checkbox" checked={item.completed} onChange={async (event) => { await window.gateHelper.syllabus.toggleTopic(item.id, event.target.checked); await syllabus.refresh(); }} /><span /></label>
              <div className="list-row__body"><div><strong>{item.title}</strong>{item.priority === 'high' && <span className="kind-badge kind-badge--test">high priority</span>}</div><p>{item.notes || (item.targetDate ? `Target: ${item.targetDate}` : 'No notes')}</p></div>
              <button className="icon-button" aria-label={`Edit ${item.title}`} onClick={() => openTopic(item)}><Pencil size={15} /></button>
              <button className="icon-button" aria-label={`Delete ${item.title}`} onClick={async () => { if (!confirm(`Delete "${item.title}" and all its subtopics?`)) return; await window.gateHelper.syllabus.deleteTopic(item.id); await syllabus.refresh(); pushToast('Topic deleted.'); }}><Trash2 size={15} /></button>
            </article>
          ))}
        </section>
      )}

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} title={topic.id ? 'Edit topic' : 'Add syllabus topic'} description="Topics may be nested under another topic.">
        <form className="form-stack" onSubmit={async (event) => { event.preventDefault(); setError(''); try { await window.gateHelper.syllabus.saveTopic(topic); setDialogOpen(false); await syllabus.refresh(); pushToast('Syllabus topic saved.'); } catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save topic.'); } }}>
          <label><span>Topic title</span><input autoFocus required maxLength={200} value={topic.title} onChange={(e) => setTopic({ ...topic, title: e.target.value })} placeholder="Operating Systems" /></label>
          <label><span>Parent topic</span><select value={topic.parentId ?? ''} onChange={(e) => setTopic({ ...topic, parentId: e.target.value || null })}><option value="">Top level</option>{topics.filter((item) => item.id !== topic.id).map((item) => <option key={item.id} value={item.id}>{item.title}</option>)}</select></label>
          <label><span>Notes</span><textarea maxLength={4000} value={topic.notes} onChange={(e) => setTopic({ ...topic, notes: e.target.value })} placeholder="Add formulas, resources, or revision notes" /></label>
          <div className="form-grid"><label><span>Target date</span><input type="date" value={topic.targetDate ?? ''} onChange={(e) => setTopic({ ...topic, targetDate: e.target.value || null })} /></label><label><span>Priority</span><select value={topic.priority} onChange={(e) => setTopic({ ...topic, priority: e.target.value as SyllabusTopicInput['priority'] })}><option value="low">Low</option><option value="normal">Normal</option><option value="high">High</option></select></label></div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <div className="dialog__actions"><button type="button" className="button button--secondary" onClick={() => setDialogOpen(false)}>Cancel</button><button className="button button--primary">Save topic</button></div>
        </form>
      </Dialog>

      <Dialog open={paperDialogOpen} onClose={() => setPaperDialogOpen(false)} title="Set your GATE paper" description="This label keeps the tracker paper-neutral while personalizing your workspace.">
        <form className="form-stack" onSubmit={async (event) => { event.preventDefault(); await window.gateHelper.syllabus.setPaperName(paperName); setPaperDialogOpen(false); await syllabus.refresh(); }}><label><span>Paper name</span><input autoFocus maxLength={120} value={paperName} onChange={(e) => setPaperName(e.target.value)} placeholder="Computer Science and Information Technology" /></label><div className="dialog__actions"><button type="button" className="button button--secondary" onClick={() => setPaperDialogOpen(false)}>Cancel</button><button className="button button--primary">Save paper</button></div></form>
      </Dialog>
    </div>
  );
}
