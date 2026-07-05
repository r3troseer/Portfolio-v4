import { Link } from "react-router";
import { ArrowLeft } from "lucide-react";
import "../styles/profile/base.css";

export const NotFound = () => (
  <section className="pf-notfound">
    <span className="pf-eyebrow">404</span>
    <h1>Page not found</h1>
    <p>That page doesn&apos;t exist - let&apos;s get you back to the work.</p>
    <Link to="/" className="pf-btn-primary">
      <ArrowLeft size={16} /> Back home
    </Link>
  </section>
);
