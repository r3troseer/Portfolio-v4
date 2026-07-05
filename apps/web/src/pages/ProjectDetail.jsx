import { useParams, useNavigate } from "react-router";
import { ArrowLeft, ArrowUpRight } from "lucide-react";
import { Icon } from "../components/Icon";
import { getProjectById } from "../content/adapters/projectsAdapter";
import { NotFound } from "./NotFound";
import { Badge } from "../components/Badge";
import { ContentCard } from "../components/ContentCard";
import { ProblemSolutionCard } from "../components/ProblemSolutionCard";
import { Timeline } from "../components/Timeline";
import "../styles/profile/detail.css";

// Presentation-only mapping from a link icon key to a lucide icon name.
const linkIconMap = {
  github: "github",
  docs: "book-open",
  demo: "play-circle",
  website: "globe",
};

export const ProjectDetail = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const project = getProjectById(id);

  if (!project) {
    return <NotFound />;
  }

  const { header, focus, technologies, metrics } = project;
  const links = header.links.filter((link) => link.href);
  const backToWork = () => navigate("/", { state: { scrollTo: "projects" } });

  return (
    <div className="pf-pd-wrap">
      <button type="button" className="pf-pd-back" onClick={backToWork}>
        <ArrowLeft size={16} /> Back to work
      </button>

      {/* Hero */}
      <div className="pf-pd-hero">
        {header.badge && (
          <div className="pf-pd-hero-top">
            <Badge
              text={header.badge.text}
              type={header.badge.type}
              size={header.badge.size}
            />
          </div>
        )}
        <h1 className="pf-pd-title">{header.title}</h1>
        <p className="pf-pd-subtitle">{header.subtitle}</p>
        <p className="pf-pd-overview">{header.overview}</p>

        <div className="pf-pd-meta">
          {focus && (
            <div className="pf-pd-meta-item">
              <span className="pf-pd-meta-label">Focus</span>
              <span className="pf-pd-meta-val">{focus}</span>
            </div>
          )}
          {technologies.length > 0 && (
            <div className="pf-pd-meta-item">
              <span className="pf-pd-meta-label">Stack</span>
              <div className="pf-pd-meta-stacks">
                {technologies.map((tech, i) => (
                  <span className="pf-pd-stack" key={i}>
                    {tech}
                  </span>
                ))}
              </div>
            </div>
          )}
          {links.length > 0 && (
            <div className="pf-pd-meta-item">
              <span className="pf-pd-meta-label">Links</span>
              <div className="pf-pd-links">
                {links.map((link, i) => (
                  <a
                    key={i}
                    href={link.href}
                    className="pf-pd-link"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Icon name={linkIconMap[link.icon] || "link"} size={14} />
                    {link.text}
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Metrics */}
      {metrics.length > 0 && (
        <div className="pf-pd-metrics">
          {metrics.map((metric, i) => (
            <div className="pf-pd-metric" key={i}>
              <div className="pf-pd-metric-num">{metric.number}</div>
              <div className="pf-pd-metric-label">{metric.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Content cards */}
      {project.contentCards.length > 0 && (
        <div className="pf-pd-section pf-pd-cards">
          {project.contentCards.map((card, i) => (
            <ContentCard key={i} {...card} />
          ))}
        </div>
      )}

      {/* Problem -> Solution */}
      {project.problemSolutions.length > 0 && (
        <div className="pf-pd-section">
          <h2 className="pf-pd-h">Challenges &amp; Solutions</h2>
          {project.problemSolutions.map((ps, i) => (
            <ProblemSolutionCard key={i} {...ps} />
          ))}
        </div>
      )}

      {/* Timeline */}
      {project.timeline?.length > 0 && (
        <div className="pf-pd-section">
          <h2 className="pf-pd-h">Development Timeline</h2>
          <Timeline items={project.timeline} />
        </div>
      )}

      {/* CTA */}
      <div className="pf-pd-cta">
        <div>
          <h3>Want the full story?</h3>
          <p>The code and commit history go deeper than this case study.</p>
        </div>
        <div className="pf-pd-cta-actions">
          {links[0] && (
            <a
              href={links[0].href}
              className="pf-pd-cta-btn pf-pd-cta-primary"
              target="_blank"
              rel="noopener noreferrer"
            >
              {links[0].text} <ArrowUpRight size={15} />
            </a>
          )}
          <button type="button" className="pf-pd-cta-btn" onClick={backToWork}>
            <ArrowLeft size={15} /> Back to work
          </button>
        </div>
      </div>
    </div>
  );
};
