import { ProjectCard } from "./ProjectCard";
export const Projects = () => {
  const projects = [
    {
      id: "gfa-exchange",
      title: "GFA Exchange",
      description:
        "AI-driven loan reallocation sandbox for UK SME lending. Multi-agent system with privacy-preserving marketplace, LLM-powered explainability, and financial inclusion as a first-class metric. Honourable Mention at UKFinnovator by Ukfin+.",
      technologies: ["FastAPI", "React", "TypeScript", "Multi-Agent AI", "SQLAlchemy", "Zustand"],
    },
    {
      id: "mealsync",
      title: "MealSync",
      description:
        "AI-assisted household meal planning platform. Collaborative meal scheduling, recipe management, and automated grocery lists powered by Google Gemini. 77 automated tests, 93% AI service coverage. Built with FastAPI, React, and PostgreSQL.",
      technologies: ["FastAPI", "React", "TypeScript", "Google Gemini AI", "PostgreSQL", "Pytest"],
    },
    {
      id: "studybud",
      title: "StudyBud",
      description:
        "AI-powered tool for generating summaries and quizzes from documents. Features advanced NLP techniques for text extraction from PDF and DOCX files, integrated with OpenAI's language models.",
      technologies: ["Django", "NLP", "OpenAI", "PDF Processing"],
    },
    {
      id: "ticketsage",
      title: "TicketSage",
      description:
        "Comprehensive Django-based movie booking system with automated TMDB API integration, user authentication, and automated showtime scheduling for cinema management.",
      technologies: ["Django", "TMDB API", "Authentication", "PythonAnywhere"],
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
    },
    {
      id: "train-booking",
      title: "Train Booking System",
      description:
        "Full-featured .NET backend for booking train tickets with seat availability checks, category-based pricing, and trip schedule management.",
      technologies: [".NET", "C#", "MariaDB", "CQRS", "Clean Architecture"],
    },
    {
      id: "printing-service",
      title: "Printing Service",
      description:
        "Document printing platform with .NET backend and Blazor frontend. Users upload files, pay online, receive a unique code, and retrieve their prints at a connected printing station.",
      technologies: [".NET", "Blazor", "Cloud Storage", "Payments"],
    },
    {
      id: "uk-shift-calculator",
      title: "UK Shift Calculator",
      description:
        "Progressive Web App for UK shift workers to log hours, calculate pay with 2024/25 tax and NI rates, and export payroll data. Includes offline support, weekend double pay, and CSV/JSON export.",
      technologies: ["React", "PWA", "LocalStorage", "Vercel"],
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
            />
          ))}
        </div>
      </div>
    </section>
  );
};
