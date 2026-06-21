import { getExperience } from "../content/adapters/profileAdapter";

export const Experience = () => {
  const { roles } = getExperience();
  return (
    <section id="experience">
      <div className="container">
        <h2 className="section-title fade-in">Professional Experience</h2>
        <div className="experience-timeline fade-in">
          {roles?.map((exp, idx) => (
            <div className="experience-item" key={idx}>
              <h3>{exp.title}</h3>
              <div className="company">{exp.company}</div>
              <div className="date">
                {exp.date} | {exp.location}
              </div>
              <ul>
                {exp.responsibilities.map((responsibility, i) => (
                  <li key={i}>{responsibility}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
