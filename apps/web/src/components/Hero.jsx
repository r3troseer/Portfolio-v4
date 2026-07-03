import { DynamicIcon } from "lucide-react/dynamic";
import { Sparkles, ArrowDown } from "lucide-react";
import { getProfile, getLinks } from "../content/adapters/profileAdapter";
import "../styles/profile/hero.css";

const socialIconByLabel = {
  Email: "mail",
  LinkedIn: "linkedin",
  GitHub: "github",
  Twitter: "twitter",
  X: "twitter",
};

// Render the headline with a gradient-emphasis span on `highlight`.
const renderHeadline = (headline, highlight) => {
  if (!highlight || !headline.includes(highlight)) return headline;
  const [before, after] = headline.split(highlight);
  return (
    <>
      {before}
      <span className="pf-hl">{highlight}</span>
      {after}
    </>
  );
};

export const Hero = () => {
  const { headline, headlineHighlight, role, intro, availability, facts } =
    getProfile();
  const links = getLinks();

  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: "smooth" });
  };

  // Assistant launcher: signal intent only. The Cmd/Ctrl+K shell listens for this
  // and opens the placeholder panel. No assistant/backend/LLM logic here.
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
            {availability && (
              <div className="pf-hero-pill">
                <span className="dot" /> {availability}
              </div>
            )}
            <h1 className="pf-hero-headline">
              {renderHeadline(headline, headlineHighlight)}
            </h1>
            <div className="pf-hero-role">{role}</div>
            <p className="pf-intro">{intro}</p>
            <div className="pf-hero-actions">
              <button className="pf-btn-primary" onClick={() => scrollTo("projects")}>
                View selected work <ArrowDown size={16} />
              </button>
              <button className="pf-btn-ghost" onClick={() => scrollTo("contact")}>
                Get in touch
              </button>
              <button
                type="button"
                className="pf-ask-launcher pf-ask-pill"
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
