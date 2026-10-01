import { useMemo, useState } from "react";
import type { SyllabusDocument, SyllabusTopic } from "../api/client";

type Filter = "all" | "completed" | "incomplete";

function leavesOf(topic: SyllabusTopic): SyllabusTopic[] {
  return topic.subtopics.length ? topic.subtopics.flatMap(leavesOf) : [topic];
}

function progressOf(topic: SyllabusTopic) {
  const leaves = leavesOf(topic);
  const completed = leaves.filter(item => item.completed).length;
  return { completed, total: leaves.length, percentage: leaves.length ? completed / leaves.length * 100 : 0 };
}

function matchesFilter(item: SyllabusTopic, filter: Filter) {
  return filter === "all" || (filter === "completed" ? item.completed : !item.completed);
}

function TopicSection({ topic, filter, changingId, onChange }: {
  topic: SyllabusTopic;
  filter: Filter;
  changingId: string | null;
  onChange: (topic: SyllabusTopic, completed: boolean) => void;
}) {
  const [open, setOpen] = useState(true);
  const progress = progressOf(topic);
  const items = leavesOf(topic).filter(item => matchesFilter(item, filter));
  if (!items.length) return null;

  return <section className="sheet-topic">
    <button className="sheet-topic-heading" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className={`disclosure ${open ? "open" : ""}`}>›</span><span>{topic.name}</span><small>{progress.completed} / {progress.total}</small>
    </button>
    {open && <div className="sheet-checklist">{items.map(item => <label className={`sheet-item ${item.completed ? "done" : ""}`} key={item.id}>
      <input type="checkbox" checked={item.completed} disabled={changingId !== null} onChange={event => onChange(item, event.target.checked)} /><span>{item.name}</span>
    </label>)}</div>}
  </section>;
}

function SubjectCard({ subject, filter, changingId, onChange }: {
  subject: SyllabusTopic;
  filter: Filter;
  changingId: string | null;
  onChange: (topic: SyllabusTopic, completed: boolean) => void;
}) {
  const [open, setOpen] = useState(false);
  const progress = progressOf(subject);
  const visibleTopics = subject.subtopics.filter(topic => leavesOf(topic).some(item => matchesFilter(item, filter)));
  if (!visibleTopics.length) return null;

  return <article className={`subject-card ${open ? "expanded" : ""}`}>
    <button className="subject-heading" type="button" onClick={() => setOpen(value => !value)} aria-expanded={open}>
      <span className={`disclosure ${open ? "open" : ""}`}>›</span>
      <span className="subject-title"><strong>{subject.name}</strong><small>{subject.subtopics.length} topic sections</small></span>
      <span className="subject-progress"><strong>{progress.completed} / {progress.total}</strong><i><span style={{ width: `${progress.percentage}%` }} /></i></span>
    </button>
    {open && <div className="subject-body">{visibleTopics.map(topic => <TopicSection key={topic.id} topic={topic} filter={filter} changingId={changingId} onChange={onChange} />)}</div>}
  </article>;
}

export function SyllabusTracker({ document, changingId, onProgressChange }: {
  document: SyllabusDocument;
  changingId: string | null;
  onProgressChange: (topic: SyllabusTopic, completed: boolean) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visibleCount = useMemo(() => document.topics.filter(subject => leavesOf(subject).some(item => matchesFilter(item, filter))).length, [document.topics, filter]);
  return <section className="tracker-panel syllabus-sheet">
    <div className="progress-card"><div className="progress-copy"><span className="eyebrow">Overall GATE progress</span><strong>{document.progress.percentage}%</strong><p>{document.progress.completed} of {document.progress.total} syllabus items complete</p></div><div className="progress-ring" style={{ "--progress": `${document.progress.percentage}%` } as React.CSSProperties}><span>{Math.round(document.progress.percentage)}%</span></div></div>
    <div className="tracker-toolbar"><div><strong>Subjects</strong><span>{visibleCount} of {document.topics.length} shown</span></div><div className="filter-tabs" aria-label="Filter syllabus items">{(["all", "completed", "incomplete"] as Filter[]).map(value => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "incomplete" ? "To study" : value[0].toUpperCase() + value.slice(1)}</button>)}</div></div>
    <div className="subject-list">{document.topics.map(subject => <SubjectCard key={subject.id} subject={subject} filter={filter} changingId={changingId} onChange={onProgressChange} />)}</div>
    {!visibleCount && <div className="sheet-empty">No syllabus items match this filter.</div>}
  </section>;
}
