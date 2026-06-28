import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { TechTags } from "./TechTags";

export const ProjectCard = ({ id, title, description, technologies, revealed }) => {
  return (
    <Link
      to={`/projects/${id}`}
      className={`project-card${revealed ? " project-card-revealed" : ""}`}
    >
      <h3>{title}</h3>
      <p>{description}</p>
      <TechTags tags={technologies} />
      <span className="card-cta">View Details <ArrowRight size={14} /></span>
    </Link>
  );
};
