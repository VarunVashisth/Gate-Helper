import { useMemo, useState } from "react";
import type { SyllabusDocument, SyllabusTopic } from "../api/client";

type Filter = "all" | "completed" | "incomplete";

function filterTree(topics: SyllabusTopic[], filter: Filter): SyllabusTopic[] {
  if (filter === "all") return topics;
  return topics.flatMap((topic) => {
    const subtopics = filterTree(topic.subtopics, filter);
    const matches = filter === "completed" ? topic.completed : !topic.completed;
    return matches || subtopics.length ? [{ ...topic, subtopics }] : [];
  });
}

function TopicRows({ topics, changingId, onChange, depth = 0 }: {
  topics: SyllabusTopic[];
  changingId: string | null;
  onChange: (topic: SyllabusTopic, completed: boolean) => void;
  depth?: number;
}) {
  return <>{topics.map((topic) => <div key={topic.id} className="tracker-branch">
    <label className={`tracker-row ${topic.completed ? "done" : ""}`} style={{ "--depth": depth } as React.CSSProperties}>
      <input type="checkbox" checked={topic.completed} disabled={changingId !== null} onChange={(event) => onChange(topic, event.target.checked)} />
      <span className="topic-name">{topic.name}</span>
      {topic.subtopics.length > 0 && <small>{topic.subtopics.length} item{topic.subtopics.length === 1 ? "" : "s"}</small>}
    </label>
    <TopicRows topics={topic.subtopics} changingId={changingId} onChange={onChange} depth={depth + 1} />
  </div>)}</>;
}

export function SyllabusTracker({ document, changingId, onProgressChange }: {
  document: SyllabusDocument;
  changingId: string | null;
  onProgressChange: (topic: SyllabusTopic, completed: boolean) => void;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const visibleTopics = useMemo(() => filterTree(document.topics, filter), [document.topics, filter]);
  return <section className="tracker-panel">
    <div className="progress-card"><div className="progress-copy"><span className="eyebrow">Leaf-topic progress</span><strong>{document.progress.percentage}%</strong><p>{document.progress.completed} of {document.progress.total} topics complete</p></div><div className="progress-ring" style={{ "--progress": `${document.progress.percentage}%` } as React.CSSProperties}><span>{Math.round(document.progress.percentage)}%</span></div></div>
    <div className="tracker-toolbar"><div className="filter-tabs" aria-label="Filter topics">{(["all", "completed", "incomplete"] as Filter[]).map((value) => <button type="button" key={value} className={filter === value ? "active" : ""} onClick={() => setFilter(value)}>{value === "incomplete" ? "Not completed" : value[0].toUpperCase() + value.slice(1)}</button>)}</div><span>{visibleTopics.length ? "Showing matching branches" : "No matching topics"}</span></div>
    <div className="topic-tracker"><TopicRows topics={visibleTopics} changingId={changingId} onChange={onProgressChange} /></div>
  </section>;
}

