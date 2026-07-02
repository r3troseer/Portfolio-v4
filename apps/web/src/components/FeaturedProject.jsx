import { Link } from "react-router";
import { ArrowRight } from "lucide-react";

export const FeaturedProject = ({ id, title, subtitle, description, metrics }) => (
  <Link to={`/projects/${id}`} className="pf-featured">
    <div className="pf-featured-body">
      <span className="pf-featured-tag">Featured Project</span>
      <h3>{title}</h3>
      <div className="pf-featured-sub">{subtitle}</div>
      <p>{description}</p>
      <span className="pf-featured-cta">
        View project <ArrowRight size={15} />
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
