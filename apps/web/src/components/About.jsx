import { Capabilities } from "./Capabilities";
import { getProfile } from "../content/adapters/profileAdapter";

export const About = () => {
  const { bio } = getProfile();
  return (
    <section id="about">
      <div className="container">
        <div className="pf-section-head fade-in">
          <span className="pf-eyebrow">About</span>
          <h2 className="section-title">About Me</h2>
        </div>
        <div className="about-content fade-in">
          <div className="about-text">
            {bio.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
        </div>
        <div className="pf-capabilities-wrap fade-in">
          <span className="pf-eyebrow">Capabilities</span>
          <Capabilities />
        </div>
      </div>
    </section>
  );
};
