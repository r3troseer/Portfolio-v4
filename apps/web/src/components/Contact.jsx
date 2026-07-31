import { Icon } from "./Icon";
import { getLinks } from "../content/adapters/profileAdapter";
import "../styles/profile/contact.css";

const iconByLabel = {
  LinkedIn: "linkedin",
  GitHub: "github",
  Twitter: "twitter",
  X: "twitter",
};

export const Contact = () => {
  const links = getLinks();

  return (
    <section id="contact">
      <div className="container">
        <div className="pf-contact fade-in">
          <h2>Let&apos;s build something solid.</h2>
          <p>
            I&apos;m open to backend and platform engineering roles. If you&apos;ve
            got an interesting problem, I&apos;d like to hear about it.
          </p>
          <div className="pf-contact-actions">
            <a className="pf-clink pf-clink-primary" href={`mailto:${links.email}`}>
              <Icon name="mail" size={16} /> {links.email}
            </a>
            {/* A profile can opt out of the contact list with showInContact: false
                (e.g. the Portfolio self-link, which stays in links.json for CV /
                AI export). Absent flag means shown. */}
            {links.profiles
              .filter((profile) => profile.showInContact !== false)
              .map((profile) => (
              <a
                key={profile.label}
                className="pf-clink"
                href={profile.href}
                target={profile.external ? "_blank" : undefined}
                rel={profile.external ? "noopener noreferrer" : undefined}
              >
                <Icon name={iconByLabel[profile.label] || "link"} size={16} />{" "}
                {profile.label}
              </a>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
