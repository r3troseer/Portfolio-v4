import { Skill } from "./Skill";
import { getProfile } from "../content/adapters/profileAdapter";

export const About = () => {
  const { bio } = getProfile();
  return (
    <section id="about">
      <div className="container">
        <h2 className="section-title fade-in">About Me</h2>
        <div className="about-content fade-in">
          <div className="about-text">
            {bio.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>
          <Skill />
        </div>
      </div>
    </section>
  );
};
