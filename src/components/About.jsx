import { Skill } from "./Skill";

export const About = () => {
  return (
    <section id="about">
      <div className="container">
        <h2 className="section-title fade-in">About Me</h2>
        <div className="about-content fade-in">
          <div className="about-text">
            <p>
              I'm a backend engineer based in London, currently completing an
              MSc in Computer Science at the University of East London
              (Distinction track: 88-99 across modules). I build systems in
              Python (Django, FastAPI) and C# (ASP.NET, .NET 8), with a focus
              on clean architecture, performance, and correctness.
            </p>
            <p>
              Professionally, I've worked at Touch and Pay Technologies (YC W22)
              building fintech infrastructure in ASP.NET; improving application
              performance by 20% and refactoring core logic for 50% efficiency
              gains. Before that at Reymage, I designed REST APIs handling 100k
              concurrent requests and maintained 95% test coverage across
              production Django services.
            </p>
            <p>
              Beyond standard backend work, I've built multi-agent AI systems
              (UKFinnovator by Ukfin+, Honourable Mention), NLP data pipelines
              with rule-based explainability, and a big data analytics system
              that scored 99 in my MSc module. I care about building things that
              are defensible, auditable, and actually work at scale.
            </p>
          </div>
          <Skill />
        </div>
      </div>
    </section>
  );
};
