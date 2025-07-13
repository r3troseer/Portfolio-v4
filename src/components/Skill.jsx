export const Skill = ({ skill, subskills }) => {
  const skills = [
    { title: "Python", subskill: "Django, FastAPI" },
    { title: "C#", subskill: "ASP.NET, Blazor" },
    { title: "Databases", subskill: "SQL, MongoDB" },
    { title: "DevOps", subskill: "Docker, Git" },
    { title: "Performance", subskill: "Redis, Celery" },
    { title: "APIs", subskill: "REST, Integration" },
  ];
  return (
    <div className="skills-grid">
      {skills.map((skill, index) => (
        <div className="skill-item">
          <h4>{skill.title}</h4>

          <p key={index}>{skill.subskill}</p>
        </div>
      ))}
    </div>
  );
};
