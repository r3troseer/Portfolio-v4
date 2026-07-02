import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export const ProjectList = ({ items }) => (
  <div className="pf-list">
    {items.map((project) => (
      <Link to={`/projects/${project.id}`} className="pf-list-row" key={project.id}>
        <span className="pf-list-idx">{project.idx}</span>
        <div className="pf-list-main">
          <h4>{project.title}</h4>
          <p>{project.subtitle}</p>
        </div>
        <span className="pf-list-tech">{project.techLine}</span>
        <span className="pf-list-arrow">
          <ArrowRight size={18} />
        </span>
      </Link>
    ))}
  </div>
);
