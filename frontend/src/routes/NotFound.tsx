import { Link } from "react-router-dom";
export function NotFound() { return <section className="centered-status"><span className="eyebrow">404</span><h1>That page slipped away.</h1><p>The route does not exist in GATE Helper.</p><Link className="primary-button" to="/">Return to dashboard</Link></section>; }

