import { MapPin } from "lucide-react";
import { getProfile } from "../content/adapters/profileAdapter";

export const Hero = () => {
  const { name, tagline, location } = getProfile();

  const scrollToProjects = () => {
    const element = document.getElementById("projects");
    if (element) {
      element.scrollIntoView({ behavior: "smooth" });
    }
  };

  return (
    <section id="home" className="hero">
      <div className="container">
        <div className="hero-content">
          <h1>Hi, I'm {name}</h1>
          <p className="tagline">{tagline}</p>
          <p className="hero-location"><MapPin size={14} /> {location}</p>
          <button onClick={() => scrollToProjects()} className="cta-button">
            View My Work
          </button>
        </div>
      </div>
    </section>
  );
};
