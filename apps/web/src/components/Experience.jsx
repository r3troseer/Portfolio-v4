import { getExperience } from "../content/adapters/profileAdapter";
import "../styles/profile/experience.css";

export const Experience = () => {
  const { roles } = getExperience();
  return (
    <section id="experience">
      <div className="container">
        <h2 className="section-title fade-in">Experience</h2>
        <div className="pf-resume fade-in">
          {roles?.map((role, idx) => (
            <div className="pf-resume-item" key={idx}>
              <div className="pf-resume-meta">
                <div className="date">{role.date}</div>
                <div className="loc">{role.location}</div>
              </div>
              <div className="pf-resume-body">
                <h3>{role.title}</h3>
                <div className="company">{role.company}</div>
                <ul>
                  {role.responsibilities.map((item, i) => (
                    <li key={i}>
                      <span className="pf-rb-dot" />
                      <span className="pf-rb-text">{item.t}</span>
                      {item.m && <span className="pf-rb-pill">{item.m}</span>}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
