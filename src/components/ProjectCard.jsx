import { Link } from "react-router";
import { TechTags } from "./TechTags";

export const ProjectCard = ({ id, title, description, technologies }) => {
  return (
    <Link
      to={`/projects/${id}`}
      className="project-card fade-in"
    >
      <h3>{title}</h3>
      <p>{description}</p>
      <TechTags tags={technologies} />
      <div className="card-hover-indicator">
        <span>View Details →</span>
      </div>
    </Link>
  );
};
