import { ExternalLink } from "lucide-react";
import { getLinks } from "../content/adapters/profileAdapter";

export const Contact = () => {
  const links = getLinks();
  const contacts = [
    { title: "Email", value: links.email, href: `mailto:${links.email}` },
    ...links.profiles.map((profile) => ({
      title: profile.label,
      value: profile.value,
      href: profile.href,
      target: profile.external ? "_blank" : undefined,
      rel: profile.external ? "noopener noreferrer" : undefined,
    })),
  ];
  return (
    <section id="contact">
      <div className="container">
        <h2 className="section-title fade-in">Let's Connect</h2>
        <div className="contact-content fade-in">
          <p>
            I'm always open to discussing new opportunities and interesting
            projects. Feel free to reach out if you'd like to collaborate!
          </p>
          <div className="contact-info">
            {contacts?.map((contact) => (
              <a
                href={contact.href}
                className="contact-item"
                key={contact.title}
                target={contact.target}
                rel={contact.rel}
              >
                {contact.target && <ExternalLink size={13} className="contact-item-external" />}
                <h4>{contact.title}</h4>
                <p>{contact.value}</p>
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
