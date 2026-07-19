import { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { Link, useLocation, useNavigate } from "react-router";
import { getProfile } from "../content/adapters/profileAdapter";
import { beginSpaRouteTransition } from "../lib/spaRouteTransition";
import "../styles/navigation.css";

const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
];

const MOBILE_MENU_ID = "mobile-nav-menu";

// Sections start "under" the fixed nav; treat a section as active once its top
// passes this offset so the underline hands over at a natural point.
const SPY_OFFSET = 120;

export const Navigation = () => {
  const [activeSection, setActiveSection] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === "/";
  const { name } = getProfile();
  const toggleRef = useRef(null);
  const restoreFocusRef = useRef(false);
  const previousLocationKeyRef = useRef(location.key);

  // One rAF-throttled scroll-spy handler. The active link's underline (CSS
  // .active) follows the section currently in view.
  useEffect(() => {
    if (!isHomePage) return undefined;

    let ticking = false;

    const compute = () => {
      const offset = window.scrollY + SPY_OFFSET;
      let current = SECTIONS[0].id;
      for (const { id } of SECTIONS) {
        const el = document.getElementById(id);
        if (el && el.offsetTop <= offset) current = id;
      }
      // At the very bottom, the last section wins even if it's short.
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) {
        current = SECTIONS[SECTIONS.length - 1].id;
      }
      setActiveSection(current);
    };

    const handleScroll = () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          compute();
          ticking = false;
        });
        ticking = true;
      }
    };

    compute();
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, [isHomePage]);

  // Route changes close the menu without restoring focus to the toggle -
  // navigation owns the next focus target.
  useEffect(() => {
    if (previousLocationKeyRef.current === location.key) return;
    previousLocationKeyRef.current = location.key;
    restoreFocusRef.current = false;
    setIsMobileMenuOpen(false);
  }, [location.key]);

  // Body scroll lock: same save/restore pattern as the assistant dialog.
  // Cleanup restores the exact prior inline overflow on close, unmount, or failure.
  useEffect(() => {
    if (!isMobileMenuOpen) return;
    const root = document.documentElement;
    const prevOverflow = document.body.style.overflow;
    const prevScrollbarGutter = root.style.scrollbarGutter;
    const gutterProperty = "--mobile-menu-scrollbar-gutter";
    const prevGutterValue = root.style.getPropertyValue(gutterProperty);
    const prevGutterPriority = root.style.getPropertyPriority(gutterProperty);
    const scrollbarWidth = window.innerWidth - root.getBoundingClientRect().width;
    if (scrollbarWidth > 0) root.style.scrollbarGutter = "stable";
    root.style.setProperty(gutterProperty, `${scrollbarWidth}px`);
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prevOverflow;
      root.style.scrollbarGutter = prevScrollbarGutter;
      if (prevGutterValue) {
        root.style.setProperty(
          gutterProperty,
          prevGutterValue,
          prevGutterPriority
        );
      } else {
        root.style.removeProperty(gutterProperty);
      }
    };
  }, [isMobileMenuOpen]);

  // Escape closes only while the menu is open; focus returns to the toggle.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const onKeyDown = (e) => {
      if (e.key !== "Escape") return;
      restoreFocusRef.current = true;
      setIsMobileMenuOpen(false);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [isMobileMenuOpen]);

  // Orientation changes close the menu and restore focus only when the mobile
  // toggle remains visible at the new viewport width.
  useEffect(() => {
    if (!isMobileMenuOpen) return;

    const onOrientationChange = () => {
      restoreFocusRef.current = true;
      setIsMobileMenuOpen(false);
    };

    window.addEventListener("orientationchange", onOrientationChange);
    return () =>
      window.removeEventListener("orientationchange", onOrientationChange);
  }, [isMobileMenuOpen]);

  // After close, restore focus to the toggle when the close was not navigation.
  useEffect(() => {
    if (isMobileMenuOpen || !restoreFocusRef.current) return;
    restoreFocusRef.current = false;
    const toggle = toggleRef.current;
    if (toggle && toggle.getClientRects().length > 0) toggle.focus();
  }, [isMobileMenuOpen]);

  const closeMobileMenu = ({ restoreFocus = false } = {}) => {
    restoreFocusRef.current = restoreFocus;
    setIsMobileMenuOpen(false);
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen((open) => {
      if (open) restoreFocusRef.current = false;
      return !open;
    });
  };

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();

    if (isHomePage) {
      // In-page section scroll does not move focus; restore to the toggle.
      closeMobileMenu({ restoreFocus: true });
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", `#${sectionId}`);
      }
    } else {
      // Route navigation owns the next focus target; do not restore to the toggle.
      closeMobileMenu({ restoreFocus: false });
      beginSpaRouteTransition("/");
      navigate("/", { state: { scrollTo: sectionId } });
    }
  };

  const sectionHref = (id) => (isHomePage ? `#${id}` : `/#${id}`);

  const linkClass = (id) =>
    isHomePage && activeSection === id ? "active" : "";

  const renderLinks = () =>
    SECTIONS.map(({ id, label }) => (
      <li key={id}>
        <a
          href={sectionHref(id)}
          onClick={(e) => scrollToSection(e, id)}
          className={linkClass(id)}
        >
          {label}
        </a>
      </li>
    ));

  return (
    <nav className="nav">
      <div className="nav-container">
        <Link to="/" className="logo">
          {name}
        </Link>
        <ul className="nav-links">{renderLinks()}</ul>

        {/* Mobile Hamburger Button */}
        <button
          ref={toggleRef}
          type="button"
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "active" : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls={MOBILE_MENU_ID}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Mobile Navigation Menu */}
        <div
          id={MOBILE_MENU_ID}
          className={`mobile-menu ${isMobileMenuOpen ? "active" : ""}`}
        >
          <ul className="mobile-nav-links">{renderLinks()}</ul>
        </div>
      </div>

      {/* Overlay lives on document.body so backdrop-filter/transform on nav
          cannot create a containing block that clips viewport coverage.
          Visual stacking (under nav chrome, over page) is unchanged via z-index. */}
      {isMobileMenuOpen &&
        createPortal(
          <div
            className="mobile-menu-overlay"
            onClick={() => closeMobileMenu({ restoreFocus: true })}
            onWheel={(e) => e.preventDefault()}
            onTouchMove={(e) => e.preventDefault()}
            aria-hidden="true"
          />,
          document.body
        )}
    </nav>
  );
};
