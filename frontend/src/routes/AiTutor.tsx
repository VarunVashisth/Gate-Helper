import { Icon } from "../components/Icon";
import { PageIntro } from "../components/PageIntro";
import { usePlatform } from "../context/PlatformContext";

const downloadUrl = import.meta.env.VITE_DESKTOP_DOWNLOAD_URL ?? "https://github.com/";

export function AiTutor() {
  const platform = usePlatform();
  if (platform.status === "loading") return <StatusCard title="Checking your platform…" body="Connecting to the GATE Helper backend." />;
  if (platform.status === "error") return <StatusCard title="Backend unavailable" body={platform.error} action={<button onClick={platform.retry}>Try again</button>} />;
  if (platform.info.mode === "web") return <><PageIntro eyebrow="Local intelligence" title="AI Tutor" description="A private study partner powered by a model running on your own computer." /><section className="tutor-card web"><div className="tutor-symbol"><Icon name="tutor" size={36} /></div><span className="eyebrow">Desktop exclusive</span><h2>Take your tutor offline.</h2><p>The local AI Tutor needs the desktop app to connect securely to Ollama on your machine. Syllabus and test features remain available on the web.</p><a className="primary-button" href={downloadUrl} target="_blank" rel="noreferrer">Download desktop app <Icon name="arrow" size={18} /></a></section></>;
  return <><PageIntro eyebrow="Local intelligence" title="AI Tutor" description="Ask for explanations grounded in the subjects you are preparing." /><section className="tutor-card desktop"><div className={`connection-badge ${platform.info.ollama_available ? "online" : "offline"}`}><span />{platform.info.ollama_available ? "Ollama detected" : "Ollama not detected"}</div><div className="tutor-symbol"><Icon name="spark" size={36} /></div><h2>{platform.info.ollama_available ? "Your tutor is ready for Phase 3." : "Connect Ollama to continue."}</h2><p>{platform.info.ollama_available ? "Model selection and streaming chat will be added in the AI Tutor phase." : "Install and start Ollama locally. This page checks its default port each time the app starts."}</p></section></>;
}

function StatusCard({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) { return <section className="centered-status"><div className="spinner" /><h1>{title}</h1><p>{body}</p>{action}</section>; }

