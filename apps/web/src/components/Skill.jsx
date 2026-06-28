import { getSkills } from "../content/adapters/profileAdapter";

export const Skill = () => {
  const { groups } = getSkills();
  return (
    <div className="skills-grid">
      {groups.map((group, index) => (
        <div className="skill-item" key={index}>
          <h4>{group.title}</h4>
          <p>{group.subskill}</p>
        </div>
      ))}
    </div>
  );
};
