import { DynamicIcon } from "lucide-react/dynamic";
import { getLinks } from "../content/adapters/profileAdapter";
import "../styles/profile/contact.css";

const iconByLabel = {
  Email: "mail",
  LinkedIn: "linkedin",
  GitHub: "github",
  Twitter: "twitter",
  X: "twitter",
};

export const Contact = () => {
  const links = getLinks();
  const actions = [
    { label: "Email", href: `mailto:${links.email}`, icon: "mail", external: false },
    ...links.profiles.map((p) => ({
      label: p.label,
      href: p.href,
      icon: iconByLabel[p.label] || "link",
      external: p.external,
    })),
  ];

  return (
    <section id="contact">
      <div className="container">
        <div className="pf-contact fade-in">
          <span className="pf-eyebrow">Contact</span>
          <h2>Let&apos;s collaborate</h2>
          <p>
            I&apos;m open to backend and applied-AI roles and interesting problems.
            The fastest way to reach me is email — or find me below.
          </p>
          <div className="pf-contact-actions">
            {actions.map((action, i) => (
              <a
                key={i}
                className="pf-clink"
                href={action.href}
                target={action.external ? "_blank" : undefined}
                rel={action.external ? "noopener noreferrer" : undefined}
              >
                <DynamicIcon name={action.icon} size={16} /> {action.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
