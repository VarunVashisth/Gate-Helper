import { Icon } from "../components/Icon";
import { PageIntro } from "../components/PageIntro";

const cards = [
  { label: "Syllabus progress", value: "0%", note: "Import a syllabus to begin", icon: "syllabus" as const },
  { label: "Tests completed", value: "0", note: "Your attempts will appear here", icon: "tests" as const },
  { label: "Average score", value: "—", note: "No scored attempts yet", icon: "results" as const },
];

export function Dashboard() {
  return <><PageIntro eyebrow="Your learning dashboard" title="Good to see you." description="Build a clear plan, practise deliberately, and keep every part of your GATE preparation in view." /><section className="stat-grid">{cards.map(card => <article className="stat-card" key={card.label}><div className="stat-icon"><Icon name={card.icon} /></div><span>{card.label}</span><strong>{card.value}</strong><small>{card.note}</small></article>)}</section><section className="feature-panel"><div><span className="eyebrow">Recommended next step</span><h2>Turn the official syllabus into a plan you can finish.</h2><p>Import the GATE syllabus, organise each subject, and mark topics complete as you study.</p><a className="primary-button" href="/syllabus">Set up your syllabus <Icon name="arrow" size={18} /></a></div><div className="decorative-orbit"><span>2027</span></div></section></>;
}
