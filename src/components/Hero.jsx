import { MapPin } from "lucide-react";

export const Hero = () => {
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
          <h1>Hi, I'm Pius Agboola</h1>
          <p className="tagline">
            Backend engineer with a track record in fintech and AI systems. 
            I care about correctness and performance, not just shipping.
          </p>
          <p className="hero-location"><MapPin size={14} /> London, United Kingdom</p>
          <button onClick={() => scrollToProjects()} className="cta-button">
            View My Work
          </button>
        </div>
      </div>
    </section>
  );
};
