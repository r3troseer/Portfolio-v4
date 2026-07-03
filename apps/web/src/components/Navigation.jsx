import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { getProfile } from "../content/adapters/profileAdapter";
import "../styles/navigation.css";

const SECTIONS = [
  { id: "home", label: "Home" },
  { id: "about", label: "About" },
  { id: "projects", label: "Projects" },
  { id: "experience", label: "Experience" },
  { id: "contact", label: "Contact" },
];

// Sections start "under" the fixed nav; treat a section as active once its top
// passes this offset so the underline hands over at a natural point.
const SPY_OFFSET = 120;

export const Navigation = () => {
  const [navBackground, setNavBackground] = useState(false);
  const [activeSection, setActiveSection] = useState("home");
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === "/";
  const { name } = getProfile();

  // One rAF-throttled scroll handler: nav background + scroll-spy. The active
  // link's underline (CSS .active) follows the section currently in view.
  useEffect(() => {
    let ticking = false;

    const compute = () => {
      setNavBackground(window.scrollY > 100);

      if (!isHomePage) return;
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

  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location]);

  const closeMobileMenu = () => setIsMobileMenuOpen(false);

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const scrollToSection = (e, sectionId) => {
    e.preventDefault();
    closeMobileMenu();

    if (isHomePage) {
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
        window.history.pushState(null, "", `#${sectionId}`);
      }
    } else {
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
    <nav className={`nav ${navBackground ? "nav-scrolled" : ""}`}>
      <div className="nav-container">
        <Link to="/" className="logo">{name}</Link>
        <ul className="nav-links">{renderLinks()}</ul>

        {/* Mobile Hamburger Button */}
        <button
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "active" : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
          aria-expanded={isMobileMenuOpen}
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Mobile Navigation Menu */}
        <div className={`mobile-menu ${isMobileMenuOpen ? "active" : ""}`}>
          <ul className="mobile-nav-links">{renderLinks()}</ul>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div
          className="mobile-menu-overlay"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
    </nav>
  );
};
