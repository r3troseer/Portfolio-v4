import { Capabilities } from "./Capabilities";
import { getProfile } from "../content/adapters/profileAdapter";

export const About = () => {
  const { bioShort } = getProfile();
  return (
    <section id="about">
      <div className="container">
        <h2 className="section-title fade-in">About</h2>
        {bioShort && <p className="pf-about-lead fade-in">{bioShort}</p>}
        <h2 className="section-title pf-cap-title fade-in">Capabilities</h2>
        <Capabilities />
      </div>
    </section>
  );
};
