import { Capabilities } from "./Capabilities";
import { getProfile } from "../content/adapters/profileAdapter";

export const About = () => {
  const { bioShort } = getProfile();
  return (
    <section id="about">
      <div className="container">
        {bioShort && <p className="pf-about-lead fade-in">{bioShort}</p>}
        <h2 className="section-title fade-in">Capabilities</h2>
        <Capabilities />
      </div>
    </section>
  );
};
