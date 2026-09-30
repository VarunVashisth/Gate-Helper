import { useRef, useState } from "react";
import type { CSSProperties, DragEvent } from "react";
import { api } from "../api/client";
import type { SyllabusDocument, SyllabusImportPreview, SyllabusTopic } from "../api/client";
import {
  addChildTopic,
  addRootTopic,
  countLeafTopics,
  countTopics,
  flattenTopics,
  indentTopic,
  moveTopic,
  outdentTopic,
  removeTopic,
  renameTopic,
} from "../utils/topicTree";

const MAX_FILE_BYTES = 20 * 1024 * 1024;

function clonePreview(preview: SyllabusImportPreview): SyllabusImportPreview {
  return structuredClone(preview);
}

function RowAction({ label, disabled, onClick, children, danger = false }: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
  danger?: boolean;
}) {
  return <button
    type="button"
    className={danger ? "danger-action" : ""}
    title={label}
    aria-label={label}
    disabled={disabled}
    onClick={onClick}
  >{children}</button>;
}

export function SyllabusImport({ hasExisting, onCancel, onSaved }: {
  hasExisting: boolean;
  onCancel: () => void;
  onSaved: (document: SyllabusDocument) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<SyllabusImportPreview | null>(null);
  const [originalPreview, setOriginalPreview] = useState<SyllabusImportPreview | null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function chooseFile(nextFile: File | null) {
    setError(null);
    if (!nextFile) return;
    if (nextFile.type && nextFile.type !== "application/pdf" && !nextFile.name.toLowerCase().endsWith(".pdf")) {
      setError("Choose a PDF file to continue.");
      return;
    }
    if (nextFile.size > MAX_FILE_BYTES) {
      setError("This PDF is larger than 20 MB. Choose a smaller syllabus file.");
      return;
    }
    setFile(nextFile);
  }

  function handleDrop(event: DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setDragging(false);
    chooseFile(event.dataTransfer.files[0] ?? null);
  }

  async function extract() {
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const extracted = await api.importSyllabus(file);
      setPreview(extracted);
      setOriginalPreview(clonePreview(extracted));
      setCollapsed(new Set());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to extract this PDF.");
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!preview) return;
    const hasBlankName = flattenTopics(preview.topics).some(({ topic }) => !topic.name.trim());
    if (hasBlankName) {
      setError("Every topic needs a name before saving.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      onSaved(await api.saveSyllabus(preview.topics));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to save the syllabus.");
    } finally {
      setBusy(false);
    }
  }

  function updateTopics(topics: SyllabusTopic[]) {
    setPreview((current) => current ? { ...current, topics } : current);
  }

  function toggleSection(id: string) {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  if (!preview) return <section className="import-panel syllabus-workspace">
    <div className="import-stage-header">
      <span className="step-pill">Step 1 of 2</span>
      <div>
        <h2>Import the official syllabus</h2>
        <p>We will turn its sections and topic lists into an editable study plan.</p>
      </div>
    </div>

    <div
      className={`import-dropzone ${dragging ? "is-dragging" : ""} ${file ? "has-file" : ""}`}
      onClick={() => inputRef.current?.click()}
      onDragEnter={(event) => { event.preventDefault(); setDragging(true); }}
      onDragOver={(event) => event.preventDefault()}
      onDragLeave={(event) => { if (!event.currentTarget.contains(event.relatedTarget as Node)) setDragging(false); }}
      onDrop={handleDrop}
      role="button"
      tabIndex={0}
      onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") inputRef.current?.click(); }}
    >
      <input ref={inputRef} type="file" accept="application/pdf,.pdf" onChange={(event) => chooseFile(event.target.files?.[0] ?? null)} />
      <div className="upload-glyph" aria-hidden="true">{file ? "✓" : "↑"}</div>
      <div className="dropzone-copy">
        <h3>{file ? file.name : "Drop your syllabus PDF here"}</h3>
        <p>{file ? `${(file.size / 1024 / 1024).toFixed(2)} MB · Ready to extract` : "or choose a file from your computer"}</p>
      </div>
      <button type="button" className="secondary-button compact-button" onClick={(event) => { event.stopPropagation(); inputRef.current?.click(); }}>
        {file ? "Replace file" : "Browse PDF"}
      </button>
    </div>

    <div className="import-assurance" aria-label="Import details">
      <div><span>01</span><strong>Text-based PDF</strong><small>Official GATE syllabus works best</small></div>
      <div><span>02</span><strong>Review everything</strong><small>Edit before anything is saved</small></div>
      <div><span>03</span><strong>Private by default</strong><small>Your file stays with this app</small></div>
    </div>

    {hasExisting && <p className="warning-note">You already have a syllabus. Nothing changes until you review and confirm this import.</p>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="form-actions split-actions">
      <button type="button" className="ghost-button" onClick={onCancel}>Cancel</button>
      <button type="button" disabled={!file || busy} onClick={extract}>{busy ? <><span className="button-spinner" />Extracting topics</> : "Extract topics"}</button>
    </div>
  </section>;

  const totalTopics = countTopics(preview.topics);
  const leafTopics = countLeafTopics(preview.topics);
  const hasChanges = originalPreview ? JSON.stringify(preview.topics) !== JSON.stringify(originalPreview.topics) : false;

  return <section className="review-panel syllabus-workspace">
    <div className="review-topbar">
      <div className="review-title-block">
        <span className="step-pill">Step 2 of 2</span>
        <span className="eyebrow">Review and organise</span>
        <h2>{preview.title}</h2>
        <p>Check the structure, correct any wording, then save it as your tracker.</p>
      </div>
      <button type="button" className="secondary-button compact-button" onClick={() => updateTopics(addRootTopic(preview.topics))}>+ Add section</button>
    </div>

    <div className="extraction-summary" aria-label="Extraction summary">
      <div><strong>{preview.topics.length}</strong><span>Sections</span></div>
      <div><strong>{leafTopics}</strong><span>Trackable topics</span></div>
      <div><strong>{preview.page_count}</strong><span>PDF pages</span></div>
      <div><strong>{totalTopics}</strong><span>Total items</span></div>
    </div>

    {preview.warnings.map((warning) => <p className="warning-note" key={warning}>{warning}</p>)}
    <div className="review-guidance">
      <span aria-hidden="true">i</span>
      <p><strong>Everything below is editable.</strong> Rename topics directly, use the arrows to change hierarchy, or add and remove items. Reset restores the original extraction.</p>
    </div>

    <div className="section-editor" aria-label="Extracted syllabus topics">
      {preview.topics.map((section, sectionIndex) => {
        const sectionPath = [sectionIndex];
        const rows = flattenTopics(section.subtopics).map(({ topic, path }) => ({ topic, path: [sectionIndex, ...path] }));
        const isCollapsed = collapsed.has(section.id);
        return <article className="section-edit-card" key={section.id}>
          <div className="section-edit-heading">
            <button type="button" className="collapse-button" aria-label={`${isCollapsed ? "Expand" : "Collapse"} ${section.name}`} onClick={() => toggleSection(section.id)}>{isCollapsed ? "›" : "⌄"}</button>
            <span className="section-number">{String(sectionIndex + 1).padStart(2, "0")}</span>
            <input value={section.name} aria-label={`Section name: ${section.name}`} onChange={(event) => updateTopics(renameTopic(preview.topics, sectionPath, event.target.value))} />
            <span className="section-count">{section.subtopics.length ? countLeafTopics(section.subtopics) : 0} topics</span>
            <div className="row-actions section-actions">
              <RowAction label={`Move ${section.name} up`} disabled={sectionIndex === 0} onClick={() => updateTopics(moveTopic(preview.topics, sectionPath, -1))}>↑</RowAction>
              <RowAction label={`Move ${section.name} down`} disabled={sectionIndex === preview.topics.length - 1} onClick={() => updateTopics(moveTopic(preview.topics, sectionPath, 1))}>↓</RowAction>
              <RowAction label={`Add topic to ${section.name}`} onClick={() => updateTopics(addChildTopic(preview.topics, sectionPath))}>＋</RowAction>
              <RowAction label={`Remove ${section.name}`} danger onClick={() => updateTopics(removeTopic(preview.topics, sectionPath))}>×</RowAction>
            </div>
          </div>
          {!isCollapsed && <div className="section-edit-body" role="tree">
            {rows.length === 0 && <div className="empty-section"><p>No topics in this section yet.</p><button type="button" className="secondary-button compact-button" onClick={() => updateTopics(addChildTopic(preview.topics, sectionPath))}>Add first topic</button></div>}
            {rows.map(({ topic, path }) => {
              const index = path.at(-1)!;
              const depth = path.length - 2;
              return <div className="topic-edit-row" style={{ "--depth": depth } as CSSProperties} key={topic.id} role="treeitem" aria-level={depth + 1}>
                <span className="tree-connector" aria-hidden="true" />
                <span className="topic-kind">{topic.subtopics.length ? "Group" : "Topic"}</span>
                <input value={topic.name} aria-label={`Topic name: ${topic.name}`} onChange={(event) => updateTopics(renameTopic(preview.topics, path, event.target.value))} />
                <div className="row-actions">
                  <RowAction label={`Move ${topic.name} up`} disabled={index === 0} onClick={() => updateTopics(moveTopic(preview.topics, path, -1))}>↑</RowAction>
                  <RowAction label={`Move ${topic.name} down`} onClick={() => updateTopics(moveTopic(preview.topics, path, 1))}>↓</RowAction>
                  <RowAction label={`Indent ${topic.name}`} disabled={index === 0} onClick={() => updateTopics(indentTopic(preview.topics, path))}>→</RowAction>
                  <RowAction label={`Outdent ${topic.name}`} disabled={path.length === 2} onClick={() => updateTopics(outdentTopic(preview.topics, path))}>←</RowAction>
                  <RowAction label={`Add subtopic to ${topic.name}`} onClick={() => updateTopics(addChildTopic(preview.topics, path))}>＋</RowAction>
                  <RowAction label={`Remove ${topic.name}`} danger onClick={() => updateTopics(removeTopic(preview.topics, path))}>×</RowAction>
                </div>
              </div>;
            })}
          </div>}
        </article>;
      })}
    </div>

    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="review-footer">
      <div>
        <strong>{hasChanges ? "You have unsaved edits" : "Extraction ready to save"}</strong>
        <span>{leafTopics} trackable topics across {preview.topics.length} sections</span>
      </div>
      <div className="form-actions">
        <button type="button" className="ghost-button" onClick={() => { setPreview(null); setError(null); }}>Choose another PDF</button>
        <button type="button" className="secondary-button" disabled={!hasChanges} onClick={() => originalPreview && setPreview(clonePreview(originalPreview))}>Reset edits</button>
        <button type="button" disabled={!preview.topics.length || busy} onClick={save}>{busy ? "Saving…" : "Save syllabus"}</button>
      </div>
    </div>
  </section>;
}
