import { Bot, BookOpen, BrainCircuit, FilePlus2, LoaderCircle, Plus, RefreshCw, Send, Square, Trash2, WifiOff } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeKatex from 'rehype-katex';
import rehypeSanitize from 'rehype-sanitize';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import { useToastStore } from '../components/feedback/Toast';
import { PageHeader } from '../components/ui/PageHeader';
import { StatusPill } from '../components/ui/StatusPill';
import { useAsyncData } from '../hooks/useAsyncData';
import { useOllamaStatus } from '../hooks/useOllamaStatus';

export function AiTutorPage() {
  const ollama = useOllamaStatus();
  const threads = useAsyncData(() => window.gateHelper.tutor.listThreads(), []);
  const documents = useAsyncData(() => window.gateHelper.documents.list(), []);
  const pushToast = useToastStore((state) => state.push);
  const [threadId, setThreadId] = useState<string | null>(null);
  const [mode, setMode] = useState<'knowledge' | 'documents'>('knowledge');
  const [model, setModel] = useState('');
  const [selectedDocuments, setSelectedDocuments] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState('');
  const [requestId, setRequestId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [importing, setImporting] = useState(false);
  const [creatingThread, setCreatingThread] = useState(false);
  const composerRef = useRef<HTMLTextAreaElement>(null);

  const readyModels = ollama.data?.state === 'ready' ? ollama.data.models : [];
  const chatModels = readyModels.filter((item) => !item.name.toLowerCase().includes('embed'));
  const embeddingModels = readyModels.filter((item) => item.name.toLowerCase().includes('embed'));
  const selectedThread = useMemo(() => threads.data?.find((thread) => thread.id === threadId) ?? null, [threadId, threads.data]);
  const activeModel = model || selectedThread?.model || chatModels[0]?.name || '';

  const newChat = async () => {
    if (!activeModel) {
      setError('Start Ollama and install a chat model before creating a conversation.');
      return;
    }
    const existingEmpty = threads.data?.find((thread) => thread.messages.length === 0);
    if (existingEmpty) {
      setThreadId(existingEmpty.id);
      setMode(existingEmpty.mode);
      composerRef.current?.focus();
      return;
    }
    setCreatingThread(true);
    setError('');
    try {
      const thread = await window.gateHelper.tutor.createThread(activeModel);
      await threads.refresh();
      setThreadId(thread.id);
      setMode('knowledge');
      setStreaming('');
      setInput('');
      pushToast('New conversation created.');
      window.setTimeout(() => composerRef.current?.focus(), 0);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not create a conversation.');
    } finally {
      setCreatingThread(false);
    }
  };

  const sendMessage = async (event: React.FormEvent) => {
    event.preventDefault();
    const content = input.trim();
    if (!content || !activeModel || requestId) return;
    if (mode === 'documents' && selectedDocuments.length === 0) {
      setError('Select at least one indexed document.');
      return;
    }
    const id = crypto.randomUUID();
    setRequestId(id);
    setStreaming('');
    setError('');
    setInput('');
    try {
      await window.gateHelper.tutor.chat({ threadId, content, model: activeModel, mode, documentIds: selectedDocuments, requestId: id }, (streamEvent) => {
        if (streamEvent.type === 'start') setThreadId(streamEvent.threadId);
        if (streamEvent.type === 'chunk') setStreaming((value) => value + streamEvent.content);
        if (streamEvent.type === 'error') setError(streamEvent.message);
        if (streamEvent.type === 'done') {
          setStreaming('');
          setThreadId(streamEvent.thread.id);
        }
      });
      await threads.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'The tutor could not answer.');
    } finally {
      setRequestId(null);
    }
  };

  const importDocument = async () => {
    const embeddingModel = embeddingModels[0]?.name;
    if (!embeddingModel) {
      setError('Install an Ollama embedding model, such as qwen3-embedding:0.6b, before importing documents.');
      return;
    }
    setImporting(true);
    setError('');
    try {
      const document = await window.gateHelper.documents.importPdf(embeddingModel);
      await documents.refresh();
      setSelectedDocuments((values) => [...values, document.id]);
      setMode('documents');
      pushToast('Document indexed and ready for grounded questions.');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Could not import the document.');
    } finally {
      setImporting(false);
    }
  };

  const messages = selectedThread?.messages ?? [];
  return (
    <div className="page-stack tutor-page">
      <PageHeader eyebrow="Local AI Tutor" title="Understand concepts without sending them away."
        description="Stream explanations from a local model or ground answers in PDFs indexed entirely on your computer."
        action={<button className="button button--secondary" onClick={() => void ollama.refresh()} disabled={ollama.loading}><RefreshCw className={ollama.loading ? 'spin' : ''} size={16} /> Recheck Ollama</button>} />

      <section className={`connection-card connection-card--${ollama.data?.state ?? 'checking'}`}>
        <div className="connection-card__icon">{ollama.data?.state === 'unavailable' ? <WifiOff size={24} /> : <Bot size={24} />}</div>
        <div className="connection-card__body"><div className="connection-card__title-row"><div><p className="eyebrow">Connection status</p><h2>{ollama.loading ? 'Looking for Ollama…' : ollama.data?.message ?? 'Connection check failed'}</h2></div><StatusPill status={ollama.data} loading={ollama.loading} /></div>{chatModels.length > 0 && <label className="model-field"><span>Chat model</span><select value={activeModel} onChange={(e) => setModel(e.target.value)}>{chatModels.map((item) => <option key={item.name}>{item.name}</option>)}</select></label>}{ollama.data?.state === 'unavailable' && <p className="form-hint">Install and start Ollama, then install qwen3-vl:8b for tutoring and qwen3-embedding:0.6b for documents.</p>}</div>
      </section>

      <div className="tutor-workspace">
        <aside className="conversation-sidebar">
          <button className="button button--primary" disabled={creatingThread || !activeModel} onClick={() => void newChat()}><Plus size={15} /> {creatingThread ? 'Creating…' : 'New conversation'}</button>
          <p className="sidebar__label">Conversations</p>
          {threads.loading ? <LoaderCircle className="spin" size={18} /> : threads.data?.length === 0 ? <p className="conversation-empty">Your conversations will appear here.</p> : threads.data?.map((thread) => <button key={thread.id} className={thread.id === threadId ? 'conversation-item conversation-item--active' : 'conversation-item'} onClick={() => { setThreadId(thread.id); setMode(thread.mode); }}><span>{thread.title}</span><small>{thread.mode}</small></button>)}
          <div className="document-library"><div className="section-heading"><div><p className="sidebar__label">Documents</p></div></div><button className="button button--secondary button--full" onClick={() => void importDocument()} disabled={importing}><FilePlus2 size={15} /> {importing ? 'Indexing PDF…' : 'Import document PDF'}</button>{embeddingModels.length === 0 && <p className="form-hint">Document import needs an embedding model. Run <code>ollama pull qwen3-embedding:0.6b</code>, then click Recheck Ollama.</p>}{documents.data?.map((document) => <label className="document-item" key={document.id}><input type="checkbox" checked={selectedDocuments.includes(document.id)} onChange={(e) => setSelectedDocuments(e.target.checked ? [...selectedDocuments, document.id] : selectedDocuments.filter((id) => id !== document.id))} /><span><strong>{document.name}</strong><small>{document.pageCount} pages</small></span><button type="button" aria-label={`Delete ${document.name}`} onClick={async (e) => { e.preventDefault(); await window.gateHelper.documents.delete(document.id); setSelectedDocuments((values) => values.filter((id) => id !== document.id)); await documents.refresh(); }}><Trash2 size={13} /></button></label>)}</div>
        </aside>
        <section className="chat-panel">
          <div className="mode-switch"><button className={mode === 'knowledge' ? 'mode-switch__active' : ''} onClick={() => setMode('knowledge')}><BrainCircuit size={15} /> Model knowledge</button><button className={mode === 'documents' ? 'mode-switch__active' : ''} onClick={() => setMode('documents')}><BookOpen size={15} /> Your documents</button></div>
          <div className="message-list">
            {messages.length === 0 && !streaming ? <div className="chat-welcome"><div><Bot size={27} /></div><h2>What would you like to understand?</h2><p>Ask a concept question, request a worked example, or switch to document mode to ground the answer in your notes.</p></div> : messages.map((message) => <article className={`message message--${message.role}`} key={message.id}><span>{message.role === 'user' ? 'You' : 'Tutor'}</span><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeSanitize, rehypeKatex]}>{message.content}</ReactMarkdown></div>{message.citations.length > 0 && <div className="citations">{message.citations.map((citation, index) => <span key={`${citation.documentName}-${citation.page}-${index}`}>{citation.documentName} · p. {citation.page}</span>)}</div>}</article>)}
            {streaming && <article className="message message--assistant"><span>Tutor</span><div className="markdown"><ReactMarkdown remarkPlugins={[remarkGfm, remarkMath]} rehypePlugins={[rehypeSanitize, rehypeKatex]}>{streaming}</ReactMarkdown></div></article>}
          </div>
          {error && <p className="form-error" role="alert">{error}</p>}
          <form className="chat-composer" onSubmit={sendMessage}><textarea ref={composerRef} aria-label="Message the AI tutor" value={input} disabled={!activeModel || Boolean(requestId)} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }} placeholder={mode === 'documents' ? 'Ask a question about the selected documents…' : 'Type your GATE concept question here…'} />{requestId ? <button type="button" className="button button--secondary" onClick={() => void window.gateHelper.tutor.cancel(requestId)}><Square size={14} /> Stop</button> : <button className="button button--primary" disabled={!input.trim() || !activeModel}><Send size={14} /> Send</button>}</form>
          <p className="ai-disclaimer">AI explanations can be incorrect. Verify critical answers against official material.</p>
        </section>
      </div>
    </div>
  );
}
