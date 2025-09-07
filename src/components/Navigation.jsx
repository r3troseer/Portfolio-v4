import { useState, useEffect } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import "../styles/navigation.css";

export const Navigation = () => {
  const [navBackground, setNavBackground] = useState(false);
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

  const scrollToSection = (sectionId) => {
    if (isHomePage) {
      // If already on homepage, just scroll
      const element = document.getElementById(sectionId);
      if (element) {
        element.scrollIntoView({ behavior: "smooth" });
      }
    } else {
      // If on different page, navigate to home then scroll
      navigate("/");
      setTimeout(() => {
        const element = document.getElementById(sectionId);
        if (element) {
          element.scrollIntoView({ behavior: "smooth" });
        }
      }, 200);
    }
  };

  return (
    <nav className={`nav ${navBackground ? "nav-scrolled" : ""}`}>
      <div className="nav-container">
        <div className="logo">Pius Agboola</div>
        <ul className="nav-links">
          <li>
            <a
              href="#home"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("home");
              }}
              className={isHomePage ? "active" : ""}
            >
              Home
            </a>
          </li>
          <li>
            <a
              href="#about"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("about");
              }}
            >
              About
            </a>
          </li>
          <li>
            <a
              href="#projects"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("projects");
              }}
            >
              Projects
            </a>
          </li>
          <li>
            <a
              href="#experience"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("experience");
              }}
            >
              Experience
            </a>
          </li>
          <li>
            <a
              href="#contact"
              onClick={(e) => {
                e.preventDefault();
                scrollToSection("contact");
              }}
            >
              Contact
            </a>
          </li>
        </ul>
      </div>
    </nav>
  );
};
