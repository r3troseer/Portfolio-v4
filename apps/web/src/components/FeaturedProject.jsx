import { Link } from "react-router";
import { ArrowRight } from "lucide-react";
import { useIntentLinkPrefetch } from "../lib/routePrefetch";

export const FeaturedProject = ({
  id,
  title,
  subtitle,
  description,
  technologies,
  metrics,
}) => {
  const prefetch = useIntentLinkPrefetch();
  return (
    <Link to={`/projects/${id}`} prefetch={prefetch} className="pf-featured">
      <div className="pf-featured-body">
        <span className="pf-featured-tag">Featured · Honourable Mention</span>
        <h3>{title}</h3>
        <div className="pf-featured-sub">{subtitle}</div>
        <p>{description}</p>
        {technologies?.length > 0 && (
          <div className="pf-featured-tags">
            {technologies.map((tech, i) => (
              <span className="pf-chip" key={i}>
                {tech}
              </span>
            ))}
          </div>
        )}
        <span className="pf-featured-cta">
          Read case study <ArrowRight size={15} />
        </span>
      </div>
      {metrics.length > 0 && (
        <div className="pf-featured-side">
          {metrics.map((metric, i) => (
            <div className="pf-featured-metric" key={i}>
              <div className="n">{metric.number}</div>
              <div className="l">{metric.label}</div>
            </div>
          ))}
        </div>
      )}
    </Link>
  );
};
