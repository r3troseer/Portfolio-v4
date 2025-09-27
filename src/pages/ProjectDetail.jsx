import { useParams } from "react-router";
import { projects } from "../data/projects";
import { PageHeader } from "../components/PageHeader";
import { ProjectHeader } from "../components/ProjectHeader";
import { MetricItem } from "../components/MetricItem";
import { ContentCard } from "../components/ContentCard";
import { ProblemSolutionCard } from "../components/ProblemSolutionCard";
import { Timeline } from "../components/Timeline";
import "../styles/projectDetail.css";

export const ProjectDetail = () => {
  const { id } = useParams();
  //   console.log(projectId);
  const project = projects.find((p) => p.id === id);

  if (!project) {
    return (
      <section className="not-found">
        <div className="container">
          <p>Project not found</p>
        </div>
      </section>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <PageHeader
        head="Project Deep Dive"
        description="Exploring the technical decisions, challenges, and solutions behind each project"
      />

      <section className="project-details">
        <section className="container">
          {/* Project Header */}
          <ProjectHeader {...project.header} />

          {/* Metrics */}
          <div className="metrics-grid">
            {project.metrics.map((m, i) => (
              <MetricItem key={i} {...m} />
            ))}
          </div>

          {/* Content Cards */}
          <div className="content-grid">
            {project.contentCards.map((card, i) => (
              <ContentCard key={i} {...card} />
            ))}
          </div>

          {/* Problem / Solutions */}
          {project.problemSolutions.map((ps, i) => (
            <ProblemSolutionCard key={i} {...ps} />
          ))}

          {/* Timeline */}
          <ContentCard markdown={`### Development Timeline & Lessons Learned`}>
            <Timeline items={project.timeline} />
          </ContentCard>
        </section>
      </section>
    </div>
  );
};
