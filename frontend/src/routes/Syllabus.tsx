import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { api } from "../api/client";
import type { SyllabusDocument, SyllabusSummary, SyllabusTopic } from "../api/client";
import { PageIntro } from "../components/PageIntro";
import { SyllabusImport } from "../components/SyllabusImport";
import { SyllabusTracker } from "../components/SyllabusTracker";

export function SyllabusDashboard() {
  const navigate = useNavigate();
  const [syllabi, setSyllabi] = useState<SyllabusSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.listSyllabi().then(setSyllabi).catch(reason => setError(reason instanceof Error ? reason.message : "Unable to load syllabi.")).finally(() => setLoading(false));
  }, []);

  return <>
    <PageIntro eyebrow="Your study library" title="Syllabus dashboard" description="Keep multiple GATE syllabi organised and continue exactly where you left off." action={!importing ? <button type="button" onClick={() => setImporting(true)}>+ Add syllabus</button> : undefined} />
    {error && <p className="form-error" role="alert">{error}</p>}
    {loading && <section className="inline-status"><div className="spinner" /><p>Loading your syllabi…</p></section>}
    {!loading && importing && <SyllabusImport onCancel={() => setImporting(false)} onSaved={saved => saved.id && navigate(`/syllabus/${saved.id}`)} />}
    {!loading && !importing && <section className="syllabus-library">
      {syllabi.map(item => <Link className="syllabus-card" to={`/syllabus/${item.id}`} key={item.id}>
        <div className="syllabus-card-icon">{item.title.trim().charAt(0).toUpperCase()}</div>
        <div className="syllabus-card-copy"><span className="eyebrow">GATE syllabus</span><h2>{item.title}</h2><p>{item.subject_count} subjects · {item.progress.total} study items</p></div>
        <div className="syllabus-card-progress"><strong>{Math.round(item.progress.percentage)}%</strong><span>{item.progress.completed} / {item.progress.total} complete</span><i><span style={{ width: `${item.progress.percentage}%` }} /></i></div>
        <span className="syllabus-card-arrow">→</span>
      </Link>)}
      {!syllabi.length && <button type="button" className="empty-library" onClick={() => setImporting(true)}><span>＋</span><strong>Add your first syllabus</strong><small>Import an official GATE PDF to create a structured tracker.</small></button>}
    </section>}
  </>;
}

export function SyllabusDetail() {
  const { syllabusId } = useParams();
  const [document, setDocument] = useState<SyllabusDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [changingId, setChangingId] = useState<string | null>(null);

  useEffect(() => {
    if (!syllabusId) return;
    api.getSyllabusWorkspace(syllabusId).then(setDocument).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load the syllabus.")).finally(() => setLoading(false));
  }, [syllabusId]);

  async function updateProgress(topic: SyllabusTopic, completed: boolean) {
    setChangingId(topic.id);
    setError(null);
    try { if (syllabusId) setDocument(await api.updateWorkspaceProgress(syllabusId, topic.id, completed)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update progress."); }
    finally { setChangingId(null); }
  }

  return <>
    <div className="syllabus-breadcrumb"><Link to="/syllabus">← All syllabi</Link></div>
    <PageIntro eyebrow="Your roadmap" title={document?.title ?? "Syllabus tracker"} description="Track every subject, topic, and study item from the official syllabus." />
    {loading && <section className="inline-status"><div className="spinner" /><p>Loading your syllabus…</p></section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && document && <SyllabusTracker document={document} changingId={changingId} onProgressChange={updateProgress} />}
  </>;
}
