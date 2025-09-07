import { ProjectCard } from "./ProjectCard";
export const Projects = () => {
  const projects = [
    {
      id: "studybud", // Add unique ID for routing
      title: "StudyBud",
      description:
        "AI-powered tool for generating summaries and quizzes from documents. Features advanced NLP techniques for text extraction from PDF and DOCX files, integrated with OpenAI's language models.",
      technologies: ["Django", "NLP", "OpenAI", "PDF Processing"],
      ref: "studybud", // Your existing ref property
    },
    {
      id: "ticketsage",
      title: "TicketSage",
      description:
        "Comprehensive Django-based movie booking system with automated TMDB API integration, user authentication, and automated showtime scheduling for cinema management.",
      technologies: ["Django", "TMDB API", "Authentication", "PythonAnywhere"],
      ref: "ticketsage",
    },
    {
      id: "eprep",
      title: "EPrep",
      description:
        "Student study app backend with parent-child management system, OTP-based phone verification, and structured learning content organization using Django REST Framework.",
      technologies: [
        "Django REST",
        "OTP Verification",
        "User Management",
        "Mobile Backend",
      ],
      ref: "eprep",
    },
    {
      id: "train-booking",
      title: "Train Booking System",
      description:
        "Full-featured .NET backend for booking train tickets with seat availability checks, category-based pricing, and trip schedule management.",
      technologies: [".NET", "C#", "MariaDB", "CQRS", "Clean Architecture"],
      ref: "train-booking",
    },
    {
      id: "printing-service",
      title: "Printing Service",
      description:
        "Document printing platform with .NET backend and Blazor frontend. Users upload files, pay online, receive a unique code, and retrieve their prints at a connected printing station.",
      technologies: [".NET", "Blazor", "Cloud Storage", "Payments"],
      ref: "printing-service",
    },
    {
      id: "uk-shift-calculator",
      title: "UK Shift Calculator",
      description:
        "Progressive Web App for UK shift workers to log hours, calculate pay with 2024/25 tax and NI rates, and export payroll data. Includes offline support, weekend double pay, and CSV/JSON export.",
      technologies: ["React", "PWA", "LocalStorage", "Vercel"],
      ref: "uk-shift-calculator",
    },
  ];

  return (
    <section id="projects">
      <div className="container">
        <h2 className="section-title fade-in">Featured Projects</h2>
        <div className="projects-grid">
          {projects.map((project, index) => (
            <ProjectCard
              key={project.id}
              id={project.id}
              title={project.title}
              description={project.description}
              technologies={project.technologies}
              ref={project.ref}
            />
          ))}
        </div>
      </div>
    </section>
  );
};
