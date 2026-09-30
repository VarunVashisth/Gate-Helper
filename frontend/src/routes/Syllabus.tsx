import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { SyllabusDocument, SyllabusTopic } from "../api/client";
import { PageIntro } from "../components/PageIntro";
import { SyllabusImport } from "../components/SyllabusImport";
import { SyllabusTracker } from "../components/SyllabusTracker";

export function Syllabus() {
  const [document, setDocument] = useState<SyllabusDocument | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [changingId, setChangingId] = useState<string | null>(null);

  useEffect(() => {
    api.getSyllabus().then(setDocument).catch((reason) => setError(reason instanceof Error ? reason.message : "Unable to load the syllabus.")).finally(() => setLoading(false));
  }, []);

  async function updateProgress(topic: SyllabusTopic, completed: boolean) {
    setChangingId(topic.id);
    setError(null);
    try { setDocument(await api.updateTopicProgress(topic.id, completed)); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "Unable to update progress."); }
    finally { setChangingId(null); }
  }

  const hasTopics = Boolean(document?.topics.length);
  return <>
    <PageIntro eyebrow="Your roadmap" title="Syllabus tracker" description="Import the official curriculum, review its structure, and track every topic." action={!importing && hasTopics ? <button type="button" className="secondary-button" onClick={() => setImporting(true)}>Import new PDF</button> : undefined} />
    {loading && <section className="inline-status"><div className="spinner" /><p>Loading your syllabus…</p></section>}
    {error && <p className="form-error" role="alert">{error}</p>}
    {!loading && (importing || !hasTopics) && <SyllabusImport hasExisting={hasTopics} onCancel={() => setImporting(false)} onSaved={(saved) => { setDocument(saved); setImporting(false); setError(null); }} />}
    {!loading && !importing && document && hasTopics && <SyllabusTracker document={document} changingId={changingId} onProgressChange={updateProgress} />}
  </>;
}

