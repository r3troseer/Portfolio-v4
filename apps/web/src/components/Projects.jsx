import { useLayoutEffect, useRef, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { FeaturedProject } from "./FeaturedProject";
import { ProjectList } from "./ProjectList";
import {
  getFeaturedProject,
  getProjectListItems,
} from "../content/adapters/projectsAdapter";
import "../styles/profile/projects.css";

const INITIAL_COUNT = 4;

function measureRemovedRowHeight(listEl) {
  if (!listEl) return 0;
  const rows = listEl.querySelectorAll(".pf-list-row");
  let removedHeight = 0;
  for (let i = INITIAL_COUNT; i < rows.length; i += 1) {
    removedHeight += rows[i].getBoundingClientRect().height;
  }
  return removedHeight;
}

function clampScrollY(scrollY) {
  const maxScrollY = Math.max(
    0,
    document.documentElement.scrollHeight - window.innerHeight,
  );
  return Math.min(Math.max(0, scrollY), maxScrollY);
}

export const Projects = () => {
  const featured = getFeaturedProject();
  const items = getProjectListItems();
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? items : items.slice(0, INITIAL_COUNT);
  const sectionRef = useRef(null);
  const buttonRef = useRef(null);
  const collapseRestoreRef = useRef(null);

  useLayoutEffect(() => {
    const pending = collapseRestoreRef.current;
    if (!pending || showAll) return;
    collapseRestoreRef.current = null;

    const button = buttonRef.current;
    if (!button) return;

    const { anchorTop, removedHeight, scrollY } = pending;
    const buttonRect = button.getBoundingClientRect();
    const buttonDocumentTop = buttonRect.top + window.scrollY;
    const measuredTarget = buttonDocumentTop - anchorTop;
    const estimatedTarget = scrollY - removedHeight;
    let targetScrollY = clampScrollY(
      Number.isFinite(measuredTarget) ? measuredTarget : estimatedTarget,
    );

    // Use the live nav edge if document clamping would otherwise cover the
    // control. Compute the final target first so WebKit receives one scroll.
    const nav = document.querySelector("nav");
    if (nav) {
      const navBottom = nav.getBoundingClientRect().bottom;
      const predictedTop = buttonDocumentTop - targetScrollY;
      if (predictedTop < navBottom) {
        targetScrollY = clampScrollY(buttonDocumentTop - navBottom);
      }
    }

    window.scrollTo(0, targetScrollY);
    button.focus({ preventScroll: true });
  }, [showAll]);

  const handleDisclosureToggle = () => {
    if (showAll) {
      const button = buttonRef.current;
      const listEl = sectionRef.current?.querySelector(".pf-list");
      if (button && listEl) {
        collapseRestoreRef.current = {
          anchorTop: button.getBoundingClientRect().top,
          removedHeight: measureRemovedRowHeight(listEl),
          scrollY: window.scrollY,
        };
      }
      setShowAll(false);
      return;
    }
    setShowAll(true);
  };

  return (
    <section id="projects" ref={sectionRef}>
      <div className="container">
        <h2 className="section-title fade-in">Selected Work</h2>

        {featured && <FeaturedProject {...featured} />}
        <ProjectList items={visible} />

        {items.length > INITIAL_COUNT && (
          <div className="pf-list-morewrap">
            <button
              ref={buttonRef}
              className="pf-list-morebtn"
              type="button"
              onClick={handleDisclosureToggle}
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
