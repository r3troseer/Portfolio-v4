import { Sparkles, ArrowUpRight, Command } from "lucide-react";
import { Icon } from "./Icon";
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
              {/* Reserved slot for the flying Ask launcher - the single real
                  launcher (AskLauncher, rendered by AssistantShell) rests over
                  this hidden box and reads its rect as the flight's home anchor. */}
              <span className="pf-ask-slot" aria-hidden="true">
                <Sparkles className="pf-ask-slot-ico" size={17} />
                <span className="pf-ask-slot-label">Ask about Pius</span>
                <span className="pf-ask-slot-sub">grounded in his real work</span>
                <span className="pf-ask-slot-kbd">
                  <Command size={11} />K
                </span>
              </span>
              <button className="pf-hero-outline" onClick={() => scrollTo("projects")}>
                View work
              </button>
              <button className="pf-hero-textlink" onClick={() => scrollTo("contact")}>
                Get in touch <ArrowUpRight size={15} />
              </button>
            </div>
          </div>

          <aside className="pf-facts">
            {facts?.map((fact, index) => (
              <div className="pf-fact-row" key={index}>
                <Icon name={fact.icon} size={18} className="pf-fact-icon" />
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
                  <Icon name={social.icon} size={18} />
                </a>
              ))}
            </div>
          </aside>
        </div>
      </div>
    </section>
  );
};
