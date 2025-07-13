import { Skill } from "./Skill";

export const About = () => {
  return (
    <section id="about">
      <div className="container">
        <h2 className="section-title fade-in">About Me</h2>
        <div className="about-content fade-in">
          <div className="about-text">
            <p>
              I'm a software engineer with extensive expertise across multiple
              modern frameworks including ASP.NET, FastAPI, Django, and Blazor.
              My passion lies in transforming innovative ideas into elegant,
              scalable solutions that solve real-world problems.
            </p>
            <p>
              With a proven track record of architecting scalable systems, I've
              successfully redesigned complex booking engines, optimized
              performance using Redis and intelligent caching, and built robust
              APIs that handle thousands of concurrent requests.
            </p>
            <p>
              I combine deep technical knowledge across the full stack with
              creative problem-solving abilities to deliver maintainable,
              efficient solutions that bring ideas to life.
            </p>
          </div>
          <Skill />
        </div>
      </div>
    </section>
  );
};
