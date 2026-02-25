import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import "../styles/navigation.css";

export const Navigation = () => {
  const [navBackground, setNavBackground] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const isHomePage = location.pathname === "/";

  useEffect(() => {
    const handleScroll = () => {
      setNavBackground(window.scrollY > 100);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

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
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
          window.history.replaceState(null, "", `/#${sectionId}`);
        }
      }, 100);
    }
  };

  const sectionHref = (id) => (isHomePage ? `#${id}` : `/#${id}`);

  return (
    <nav className={`nav ${navBackground ? "nav-scrolled" : ""}`}>
      <div className="nav-container">
        <Link to="/" className="logo">Pius Agboola</Link>
        <ul className="nav-links">
          <li>
            <a
              href={sectionHref("home")}
              onClick={(e) => scrollToSection(e, "home")}
              className={isHomePage ? "active" : ""}
            >
              Home
            </a>
          </li>
          <li><a href={sectionHref("about")} onClick={(e) => scrollToSection(e, "about")}>About</a></li>
          <li><a href={sectionHref("projects")} onClick={(e) => scrollToSection(e, "projects")}>Projects</a></li>
          <li><a href={sectionHref("experience")} onClick={(e) => scrollToSection(e, "experience")}>Experience</a></li>
          <li><a href={sectionHref("contact")} onClick={(e) => scrollToSection(e, "contact")}>Contact</a></li>
        </ul>

        {/* Mobile Hamburger Button */}
        <button
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "active" : ""}`}
          onClick={toggleMobileMenu}
          aria-label="Toggle mobile menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>

        {/* Mobile Navigation Menu */}
        <div className={`mobile-menu ${isMobileMenuOpen ? "active" : ""}`}>
          <ul className="mobile-nav-links">
            <li>
              <a
                href={sectionHref("home")}
                onClick={(e) => scrollToSection(e, "home")}
                className={isHomePage ? "active" : ""}
              >
                Home
              </a>
            </li>
            <li><a href={sectionHref("about")} onClick={(e) => scrollToSection(e, "about")}>About</a></li>
            <li><a href={sectionHref("projects")} onClick={(e) => scrollToSection(e, "projects")}>Projects</a></li>
            <li><a href={sectionHref("experience")} onClick={(e) => scrollToSection(e, "experience")}>Experience</a></li>
            <li><a href={sectionHref("contact")} onClick={(e) => scrollToSection(e, "contact")}>Contact</a></li>
          </ul>
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
