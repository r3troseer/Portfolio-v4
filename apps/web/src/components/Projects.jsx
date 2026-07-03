import { useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FeaturedProject } from "./FeaturedProject";
import { ProjectList } from "./ProjectList";
import {
  getFeaturedProject,
  getProjectListItems,
} from "../content/adapters/projectsAdapter";
import "../styles/profile/projects.css";

const INITIAL_COUNT = 4;

export const Projects = () => {
  const featured = getFeaturedProject();
  const items = getProjectListItems();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, INITIAL_COUNT);

  return (
    <section id="projects">
      <div className="container">
        <h2 className="section-title fade-in">Selected Work</h2>

        {featured && <FeaturedProject {...featured} />}
        <ProjectList items={visible} />

        {items.length > INITIAL_COUNT && (
          <div className="pf-list-morewrap">
            <button
              className="pf-list-morebtn"
              onClick={() => setShowAll((v) => !v)}
            >
              {showAll ? (
                <>
                  <ChevronUp size={16} /> Show less
                </>
              ) : (
                <>
                  <ChevronDown size={16} /> View more ({items.length - INITIAL_COUNT})
                </>
              )}
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
