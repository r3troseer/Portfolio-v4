import { ProjectCard } from "./ProjectCard";
export const Projects = () => {
  const projects = [
    {
      title: "StudyBud",
      description:
        "AI-powered tool for generating summaries and quizzes from documents. Features advanced NLP techniques for text extraction from PDF and DOCX files, integrated with OpenAI's language models.",
      technologies: ["Django", "NLP", "OpenAI", "PDF Processing"],
    },
    {
      title: "TicketSage",
      description:
        "Comprehensive Django-based movie booking system with automated TMDB API integration, user authentication, and automated showtime scheduling for cinema management.",
      technologies: ["Django", "TMDB API", "Authentication", "PythonAnywhere"],
    },
    {
      title: "EPrep",
      description:
        "Student study app backend with parent-child management system, OTP-based phone verification, and structured learning content organization using Django REST Framework.",
      technologies: [
        "Django REST",
        "OTP Verification",
        "User Management",
        "Mobile Backend",
      ],
    },
  ];

  return (
    <section id="projects">
      <div className="container">
        <h2 className="section-title fade-in">Featured Projects</h2>
        <div className="projects-grid">
          {projects.map((project, index) => (
            <ProjectCard
              key={index}
              title={project.title}
              description={project.description}
              technologies={project.technologies}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
