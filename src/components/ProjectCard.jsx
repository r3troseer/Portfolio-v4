export const ProjectCard = ({ title, description, technologies }) => {
  return (
    <div className="project-card fade-in">
      <h3>{title}</h3>
      <p>{description}</p>
      <div className="tech-tags">
        {technologies?.map((tech, idx) => (
          <span className="tech-tag" key={idx}>
            {tech}
          </span>
        ))}
      </div>
    </div>
  );
};
