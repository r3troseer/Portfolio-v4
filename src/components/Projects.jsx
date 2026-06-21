import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { ProjectCard } from "./ProjectCard";
import { getFeaturedProjects, getRestProjects } from "../content/adapters/projectsAdapter";
export const Projects = () => {
  const [showAll, setShowAll] = useState(false);

  const featured = getFeaturedProjects();
  const rest = getRestProjects();

  return (
    <section id="projects">
      <div className="container">
        <h2 className="section-title fade-in">Featured Projects</h2>
        <div className="projects-grid">
          {featured.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.title}
              description={project.description}
              technologies={project.technologies}
            />
          ))}
          {showAll && rest.map((project) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.title}
              description={project.description}
              technologies={project.technologies}
              revealed
            />
          ))}
        </div>
        <div className="projects-toggle-wrap">
          <button
            className="projects-toggle"
            onClick={() => setShowAll(!showAll)}
          >
            {showAll ? <><ChevronUp size={16} /> Show less</> : <>Show more projects <ChevronDown size={16} /></>}
          </button>
        </div>
      </div>
    </section>
  );
};
