import { useRef } from "react";
import { useParams, useNavigate, useLocation } from "react-router";
import { ArrowLeft, ArrowUpRight, Siren, SquareCheck } from "lucide-react";
import { Icon } from "../components/Icon";
import { getProjectById } from "../content/adapters/projectsAdapter";
import { NotFound } from "./NotFound";
import { Badge } from "../components/Badge";
import { ContentCard } from "../components/ContentCard";
import { EVIDENCE_ORIGIN, safeReturnPath } from "../lib/evidenceNavigation";
import { useDocumentTitle } from "../hooks/useDocumentTitle";
import { useRouteDestination } from "../components/RouteCompletion";
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
  const location = useLocation();
  const headingRef = useRef(null);
  const project = getProjectById(id);
  useDocumentTitle(
    project
      ? `${project.header.title} - Pius Agboola`
      : "Page not found - Pius Agboola"
  );
  useRouteDestination(headingRef, "Project", Boolean(project));

  if (!project) {
    return <NotFound />;
  }

  const { header, focus, technologies, metrics } = project;
  const links = header.links.filter((link) => link.href);

  const evidenceOrigin = location.state?.from;
  const fromPlayground = evidenceOrigin === EVIDENCE_ORIGIN.PLAYGROUND;
  const fromAssistant = evidenceOrigin === EVIDENCE_ORIGIN.ASSISTANT;

  let backLabel = "Back to work";
  let goBack = () => navigate("/", { state: { scrollTo: "projects" } });

  if (fromPlayground) {
    const query = typeof location.state?.q === "string" ? location.state.q.trim() : "";
    const roleLens =
      typeof location.state?.roleLens === "string"
        ? location.state.roleLens
        : undefined;

    backLabel = "Back to playground";
    goBack = () =>
      navigate("/playground", {
        state: query ? { q: query, roleLens } : undefined,
      });
  } else if (fromAssistant) {
    const returnTo = safeReturnPath(location.state?.returnTo);
    const query = typeof location.state?.q === "string" ? location.state.q.trim() : "";
    const roleLens =
      typeof location.state?.roleLens === "string"
        ? location.state.roleLens
        : undefined;

    backLabel = "Back to assistant";
    goBack = () =>
      navigate(returnTo, {
        replace: true,
        state: query
          ? { resumeAssistant: { query, roleLens } }
          : undefined,
      });
  }

  return (
    <div className="pf-pd-wrap">
      <button type="button" className="pf-pd-back" onClick={goBack}>
        <ArrowLeft size={16} /> {backLabel}
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
        <h1
          ref={headingRef}
          className="pf-pd-title"
          data-route-focus="project"
          tabIndex={-1}
        >
          {header.title}
        </h1>
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
            <div className="pf-pd-ps" key={i}>
              <div className="pf-pd-ps-card">
                <span className="pf-pd-ps-tag">
                  <Siren size={13} /> Problem
                </span>
                <h3 className="pf-pd-ps-title">{ps.problem.title}</h3>
                <p>
                  <strong>Issue:</strong> {ps.problem.issue}
                </p>
                <p>
                  <strong>Impact:</strong> {ps.problem.impact}
                </p>
              </div>
              <div className="pf-pd-ps-card pf-pd-solution">
                <span className="pf-pd-ps-tag">
                  <SquareCheck size={13} /> Solution
                </span>
                <h3 className="pf-pd-ps-title">{ps.solution.title}</h3>
                <p>
                  <strong>Implementation:</strong> {ps.solution.implementation}
                </p>
                <p>
                  <strong>Result:</strong> {ps.solution.result}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Timeline */}
      {project.timeline?.length > 0 && (
        <div className="pf-pd-section">
          <h2 className="pf-pd-h">Development Timeline</h2>
          <div className="pf-pd-timeline">
            {project.timeline.map((item, index) => (
              <div key={index} className="pf-pd-tl-item">
                <span className="pf-pd-tl-dot" />
                <h3 className="pf-pd-tl-title">{item.title}</h3>
                <p>{item.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="pf-pd-cta">
        <div>
          <p className="pf-pd-cta-title">Want the full story?</p>
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
          <button type="button" className="pf-pd-cta-btn" onClick={goBack}>
            <ArrowLeft size={15} /> {backLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
