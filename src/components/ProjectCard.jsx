import { useNavigate } from "react-router";
import { TechTags } from "./TechTags";

export const ProjectCard = ({ id, title, description, technologies, ref }) => {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/projects/${id}`);
  };

  return (
    <div
      className="project-card fade-in"
      onClick={handleCardClick}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          handleCardClick();
        }
      }}
      style={{ cursor: "pointer" }}
    >
      <h3>{title}</h3>
      <p>{description}</p>
      <TechTags tags={technologies} />
      <div className="card-hover-indicator">
        <span>View Details →</span>
      </div>
    </div>
  );
};
