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
            Backend Developer passionate about transforming innovative ideas
            into elegant code solutions. Specializing in ASP.NET, Django,
            FastAPI, and scalable system architecture.
          </p>
          <p className="hero-location">London, United Kingdom</p>
          <button onClick={() => scrollToProjects()} className="cta-button">
            View My Work
          </button>
        </div>
      </div>
    </section>
  );
};
