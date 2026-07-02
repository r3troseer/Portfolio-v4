import { DynamicIcon } from "lucide-react/dynamic";
import { Sparkles } from "lucide-react";
import { getProfile, getLinks } from "../content/adapters/profileAdapter";
import "../styles/profile/hero.css";

// Presentation-only mapping from a link label to a lucide icon name.
const socialIconByLabel = {
  Email: "mail",
  LinkedIn: "linkedin",
  GitHub: "github",
  Twitter: "twitter",
  X: "twitter",
};

export const Hero = () => {
  const { name, role, intro, availability, facts } = getProfile();
  const links = getLinks();

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Assistant launcher: signal intent only. The Cmd/Ctrl+K shell (later slice)
  // listens for this event and opens the placeholder panel. No assistant,
  // backend, or LLM logic lives here.
  const openAssistant = () => {
    window.dispatchEvent(new CustomEvent("pf:open-assistant"));
  };

  const socials = [
    { label: "Email", href: `mailto:${links.email}`, icon: "mail", external: false },
    ...links.profiles.map((p) => ({
      label: p.label,
      href: p.href,
      icon: socialIconByLabel[p.label] || "link",
      external: p.external,
    })),
  ];

  return (
    <section id="home" className="hero">
      <div className="container">
        <div className="pf-hero-grid">
          <div className="pf-hero-main">
            <span className="pf-eyebrow pf-hero-eyebrow">{role}</span>
            <h1 className="pf-hero-name">{name}</h1>
            <p className="pf-intro">{intro}</p>
            {availability && (
              <div className="pf-hero-pill">
                <span className="dot" /> {availability}
              </div>
            )}
            <div className="pf-hero-actions">
              <button className="pf-btn-primary" onClick={() => scrollTo("projects")}>
                View My Work
              </button>
              <button className="pf-btn-ghost" onClick={() => scrollTo("contact")}>
                Get in touch
              </button>
              <button
                type="button"
                className="pf-ask-launcher"
                onClick={openAssistant}
                aria-label="Ask about Pius (Command or Control + K)"
              >
                <Sparkles size={14} /> Ask about Pius
                <span className="pf-kbd">⌘K</span>
              </button>
            </div>
          </div>

          <aside className="pf-facts">
            {facts?.map((fact, index) => (
              <div className="pf-fact-row" key={index}>
                <DynamicIcon name={fact.icon} size={18} className="pf-fact-icon" />
                <div>
                  <div className="pf-fact-label">{fact.label}</div>
                  <div className="pf-fact-value">{fact.value}</div>
                </div>
              </div>
            ))}
            <div className="pf-facts-links">
              {socials.map((social, index) => (
                <a
                  key={index}
                  href={social.href}
                  className="pf-facts-link"
                  aria-label={social.label}
                  target={social.external ? "_blank" : undefined}
                  rel={social.external ? "noopener noreferrer" : undefined}
                >
                  <DynamicIcon name={social.icon} size={18} />
                </a>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
