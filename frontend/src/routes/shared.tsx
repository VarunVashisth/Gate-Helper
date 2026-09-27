export function PlaceholderCard({ step, title, body }: { step: string; title: string; body: string }) { return <section className="placeholder-card"><span>{step}</span><div><h2>{title}</h2><p>{body}</p></div></section>; }

