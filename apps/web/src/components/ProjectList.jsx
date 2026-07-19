import { Link } from "react-router";
import { ArrowUpRight } from "lucide-react";
import { useIntentLinkPrefetch } from "../lib/routePrefetch";

export const ProjectList = ({ items }) => {
  const prefetch = useIntentLinkPrefetch();
  return (
    <div className="pf-list">
      {items.map((project) => (
        <Link
          to={`/projects/${project.id}`}
          prefetch={prefetch}
          className="pf-list-row"
          key={project.id}
        >
          <span className="pf-list-idx">{project.idx}</span>
          <div className="pf-list-main">
            <h3 className="pf-list-title">{project.title}</h3>
            <p>{project.subtitle}</p>
          </div>
          <span className="pf-list-tech">{project.techLine}</span>
          <span className="pf-list-arrow">
            <ArrowUpRight size={18} />
          </span>
        </Link>
      ))}
    </div>
  );
};
