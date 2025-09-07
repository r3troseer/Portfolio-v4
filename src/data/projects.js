const baseUrl = process.env.REACT_APP_IMAGE_BASE;
//move baseURL from here
export const ContentType = Object.freeze({
  Architecture: "Architecture",
  Features: "Features",
});
export const projects = [
  {
    id: "studybud",
    header: {
      title: "StudyBud",
      subtitle: "AI-Powered Document Analysis & Quiz Generation",
      overview:
        "StudyBud was my final year project, designed to help students interact with study materials in a smarter way. The platform lets users upload PDF or DOCX files, then leverages NLP and GPT-based models to generate summaries and quizzes that boost learning retention.",
      links: [
        {
          icon: "github",
          text: "View Code",
          href: "https://github.com/r3troseer/StudyBud",
        },
      ],
    },
    metrics: [
      { number: "95%", label: "Text Extraction Accuracy" },
      { number: "3s", label: "Avg Processing Time" },
      { number: "10MB", label: "Max Document Size" },
      { number: "500+", label: "Documents Processed" },
    ],
    contentCards: [
      {
        markdown: `### Architecture
- **Django + Django REST Framework** for backend API and user management.
- **Celery + Redis** for asynchronous processing of large documents.
- **PyMuPDF** chosen over PyPDF2 for much faster PDF extraction.
- **docx2txt** selected after comparing with mammoth and python-docx.
- **NLTK** for preprocessing and tokenization of extracted text.
- **Chunking Strategy**: Large documents broken into smaller tokenized chunks for efficient GPT processing.
- **OpenAI GPT Models** to generate contextual summaries and quiz questions.
- **PostgreSQL** for reliable and scalable data storage.`,
        type: ContentType.Architecture,
        tags: [
          "Django",
          "Celery",
          "Redis",
          "PyMuPDF",
          "docx2txt",
          "NLTK",
          "OpenAI API",
          "PostgreSQL",
        ],
        gallery: {
          title: "Architecture & Workflow",
          images: [
            {
              src: `${baseUrl}/image/upload/studybud_architecture.png`,
              title: "System Workflow",
              description:
                "High-level design of the document processing and quiz generation pipeline.",
            },
            {
              src: `${baseUrl}/image/upload/studybud_wireframe.png`,
              title: "UI Wireframe",
              description:
                "The user interface is designed with a focus on simplicity and usability",
            },
          ],
        },
      },
      {
        markdown: `### Features & Results
- Upload PDF/DOCX → automatic text extraction and summarization.
- Generate quizzes (MCQ, True/False, Short Answer).
- Track progress and get feedback on weak areas.
- Achieved **95% text extraction accuracy** and **sub-5 second average processing time**.
- User testing confirmed improved study efficiency and positive learning outcomes.`,
        type: ContentType.Features,
        tags: ["Quiz Generation", "Summarization", "NLP", "AI Integration"],
        gallery: {
          title: "Key Features",
          images: [
            {
              src: `${baseUrl}/image/upload/studybud_summary.png`,
              title: "Summary Page",
              description:
                "Generated document summary with highlighted key points.",
            },
            {
              src: `${baseUrl}/image/upload/StudyBud_Question.png`,
              title: "Quiz Page",
              description:
                "Interactive quizzes generated from uploaded documents.",
            },
            {
              src: `${baseUrl}/image/upload/StudyBud_Result_and_Feedback.png`,
              title: "Feedback",
              description: "User feedback and weak area identification.",
            },
          ],
        },
      },
    ],
    problemSolutions: [
      {
        problem: {
          title: "Challenge: Reliable Document Processing",
          issue:
            "PDFs with complex layouts or scanned content often broke extraction.",
          impact:
            "Low quality input reduced the accuracy of summaries and quizzes.",
        },
        solution: {
          title: "Solution: Optimized Extraction Pipeline",
          implementation:
            "Adopted PyMuPDF (fast, reliable) and docx2txt after library comparison. Added document chunking and tokenization to handle large files.",
          result:
            "Extraction accuracy improved from ~70% to ~95%, with smooth performance even on 10MB+ files.",
        },
      },
      {
        problem: {
          title: "Challenge: API Costs & Rate Limits",
          issue: "Heavy use of OpenAI API caused latency and budget concerns.",
          impact:
            "Processing could take 30s+ and exceed project resource limits.",
        },
        solution: {
          title: "Solution: Caching & Prompt Optimization",
          implementation:
            "Implemented Redis caching, batched requests, and optimized prompts to reduce token usage.",
          result:
            "Reduced response time to ~3s and API costs by ~60% while maintaining output quality.",
        },
      },
    ],
    timeline: [
      {
        title: "Week 1–2: Research & Setup",
        description:
          "Explored NLP libraries, compared PDF/DOCX extraction tools, and set up Django project.",
      },
      {
        title: "Week 3–4: Core Pipeline",
        description:
          "Implemented document upload, PyMuPDF/docx2txt integration, and summarization pipeline.",
      },
      {
        title: "Week 5–6: AI Integration",
        description:
          "Integrated GPT models, built quiz generation, added caching and chunking strategies.",
      },
      {
        title: "Week 7–8: Testing & UI",
        description:
          "Refined UI/UX, integrated user accounts, gathered feedback, and optimized performance.",
      },
    ],
  },

  //   {
  //     id: "eprep",
  //     header: {
  //       title: "EPrep",
  //       subtitle: "E-learning platform built with Django",
  //       overview:
  //         "EPrep is an e-learning platform built with Django, introducing structured learning content, OTP-based phone verification, and hierarchical parent-child management for education workflows.",
  //       links: [
  //         {
  //           href: "https://github.com/r3troseer/EPrep",
  //           text: "View Code",
  //           icon: "github",
  //         },
  //       ],
  //     },
  //     metrics: [
  //       { number: "—", label: "Django backend" },
  //       { number: "—", label: "OTP phone verification" },
  //       { number: "—", label: "Parent-child management system" },
  //     ],
  //     contentCards: [
  //       {
  //         markdown: `### Architecture
  // #### Authentication & Verification
  // Implements OTP-based phone verification to secure user sign-ups.
  // #### User Roles
  // Supports roles like student, parent, and admin for flexible access control.
  // #### Content Organization
  // Structured learning modules with hierarchical relationships modeled via Django ORM.`,
  //         tags: ["Django", "OTP", "Structured Content", "Role-based Access"],
  //       },
  //       {
  //         markdown: `### Features & Innovation
  // - Secure user onboarding with OTP via phone.
  // - Hierarchical parent-child accounts for parents to monitor student progress.
  // - Organized course/module content for guided learning.`,
  //       },
  //     ],
  //     problemSolutions: [
  //       {
  //         problem: {
  //           title: "🚨 Challenge: Secure Onboarding at Scale",
  //           issue:
  //             "Email-only onboarding lacked trust; phone-based OTP verification needed to be scalable and secure.",
  //           impact: "Lower user trust and increased risk of fraudulent accounts.",
  //         },
  //         solution: {
  //           title: "✅ Solution: Integrate OTP-as-a-Service",
  //           implementation:
  //             "Integrated an OTP delivery provider and bound flow into Django authentication.",
  //           result:
  //             "Higher trust, reduced account abuse, improved signup success rates.",
  //         },
  //       },
  //     ],
  //     timeline: [
  //       {
  //         title: "Phase 1: MVP Setup",
  //         description:
  //           "Built baseline Django app and user model with phone field.",
  //       },
  //       {
  //         title: "Phase 2: OTP Verification",
  //         description:
  //           "Set up OTP generation, sending, and validation during registration.",
  //       },
  //       {
  //         title: "Phase 3: Structuring Content",
  //         description:
  //           "Designed learning content structure and parent/student relationships.",
  //       },
  //     ],
  //     galleryTitle: "EPrep Interface",
  //     gallery: [
  //       {
  //         src: "/images/eprep-register.png",
  //         alt: "EPrep register UI",
  //         title: "Phone OTP Registration",
  //         description: "Secure sign-up flow using OTP verification.",
  //       },
  //       {
  //         src: "/images/eprep-dashboard.png",
  //         alt: "EPrep dashboard UI",
  //         title: "Learning Dashboard",
  //         description: "User dashboard showing available courses and progress.",
  //       },
  //     ],
  //   },
  {
    id: "uk-shift-calculator",
    header: {
      title: "UK Shift Calculator",
      subtitle: "PWA for Shift Tracking & Pay Estimation",
      overview:
        "A React-based progressive web app that helps shift workers in the UK log hours, calculate pay, and estimate tax/NI deductions. Features a live time clock, weekend pay boost, common shift detection, and data export. Designed for portability and offline-first use.",
      links: [
        {
          icon: "github",
          text: "View Code",
          href: "https://github.com/r3troseer/UK-Shift-Calculator",
        },
        {
          icon: "website",
          text: "Live Demo",
          href: "https://uk-shift-calculator.vercel.app/",
        },
      ],
    },
    metrics: [
      { number: "1000+", label: "Shifts logged in testing" },
      { number: "2x", label: "Weekend Pay Multiplier" },
      { number: "2024/25", label: "Tax Bands Supported" },
      { number: "100%", label: "Offline Capability" },
    ],
    contentCards: [
      {
        markdown: `### Technical Architecture
- **Frontend:** React with hooks, TailwindCSS for styling, Lucide icons.
- **PWA:** Installable app with offline support and local data persistence.
- **State Management:** LocalStorage with autosave for shifts and settings.
- **Pay Engine:** Implements 2024/25 UK tax bands and NI contributions.
- **Deployment:** Hosted on Vercel for scalability and accessibility.`,
        type: ContentType.Architecture,
        tags: ["React", "PWA", "TailwindCSS", "LocalStorage", "Vercel"],
      },
      {
        markdown: `### Features & User Experience
- **Time Clock:** Clock in/out, start/end breaks, track elapsed hours.
- **Common Shifts:** Automatically suggests frequent shift patterns.
- **Weekend Pay:** Automatic 2x rate for Saturday and Sunday shifts.
- **Export:** Download CSV/JSON summaries for payroll and records.
- **Responsive UI:** Mobile-first design for workers on the go.`,
        type: ContentType.Features,
        tags: [
          "Shift Tracking",
          "Tax Calculation",
          "CSV Export",
          "Responsive UI",
        ],
        gallery: {
          title: "Screenshots",
          images: [
            {
              src: "/images/ukshift-home.png",
              title: "Dashboard",
              description: "Main interface with time clock and shift tracking.",
            },
            {
              src: "/images/ukshift-summary.png",
              title: "Pay Summary",
              description: "Breakdown of gross pay, tax, NI, and net pay.",
            },
          ],
        },
      },
    ],
    problemSolutions: [
      {
        problem: {
          title: "Challenge: Accurate UK Tax Estimation",
          issue:
            "Shift workers needed realistic tax/NI deductions without manual input.",
          impact:
            "Users couldn’t rely on generic calculators for accurate take-home pay.",
        },
        solution: {
          title: "Solution: Built-in Tax Engine",
          implementation:
            "Implemented 2024/25 HMRC tax bands and NI rates in code.",
          result: "Accurate net pay estimates tailored for UK workers.",
        },
      },
      {
        problem: {
          title: "Challenge: Accessibility & Portability",
          issue: "Workers often needed the calculator on-the-go, even offline.",
          impact:
            "Web-only solutions required stable internet, limiting usability.",
        },
        solution: {
          title: "Solution: Progressive Web App (PWA)",
          implementation:
            "Added PWA support with install prompts and offline storage.",
          result: "Users can install on phone/desktop and access anywhere.",
        },
      },
    ],
    timeline: [
      {
        title: "Week 1: Concept & Research",
        description:
          "Defined requirements and studied UK tax system + shift work needs.",
      },
      {
        title: "Week 2–3: Core Development",
        description:
          "Built React components, tax engine, and localStorage persistence.",
      },
      {
        title: "Week 4: PWA Enhancements",
        description: "Added installability, offline mode, and export features.",
      },
      {
        title: "Week 5: UI & Deployment",
        description: "Polished responsive design and deployed live on Vercel.",
      },
    ],
  },
  //   {
  //     id: "train-booking",
  //     header: {
  //       title: "Train Booking System",
  //       subtitle: "Booking trains with .NET backend",
  //       overview:
  //         "A train reservation system built with .NET, allowing users to search schedules, select seats, and book train tickets.",
  //       links: [{ href: "#", text: "View Code", icon: "github" }],
  //     },
  //     metrics: [
  //       { number: "—", label: ".NET core microservices" },
  //       { number: "—", label: "Seat selection & booking" },
  //     ],
  //     contentCards: [
  //       {
  //         markdown: `### Architecture
  // Built on .NET, includes services for schedules, booking, seat selection, and user management.`,
  //       },
  //       {
  //         markdown: `### Features
  // - Browse train schedules.
  // - Select seats and make reservations.
  // - Confirm booking with ticket details.`,
  //       },
  //     ],
  //     problemSolutions: [
  //       {
  //         problem: {
  //           title: "🚨 Challenge: Seat Availability Sync",
  //           issue:
  //             "Ensuring seat availability in real-time under concurrent bookings.",
  //           impact: "Double booking or inconsistent seat state.",
  //         },
  //         solution: {
  //           title: "✅ Solution: Transactional Locks",
  //           implementation:
  //             "Employed atomic transactional logic or concurrency locks on seat inventory.",
  //           result: "Consistent booking and no overlapping reservations.",
  //         },
  //       },
  //     ],
  //     timeline: [
  //       {
  //         title: "Phase 1: Service Design",
  //         description:
  //           "Designed backend services for schedule, seat, and booking modules.",
  //       },
  //       {
  //         title: "Phase 2: Booking Flow",
  //         description:
  //           "Implemented booking workflow with seat reservations and confirmation.",
  //       },
  //     ],
  //     galleryTitle: "Booking Flow",
  //     gallery: [
  //       {
  //         src: "/images/train-search.png",
  //         alt: "Train schedule search UI",
  //         title: "Search Schedules",
  //         description: "Find trains by date and destination.",
  //       },
  //       {
  //         src: "/images/train-booking.png",
  //         alt: "Train booking UI",
  //         title: "Seat Reservation",
  //         description: "Select seat and complete booking.",
  //       },
  //     ],
  //   },

  //   {
  //     id: "printing-service",
  //     header: {
  //       title: "Printing Service",
  //       subtitle: "Document-to-Print service with .NET/Blazor",
  //       overview:
  //         "A document printing service with both backend and front-end built in .NET/Blazor. Users upload docs, receive a print code, pay per page (and color), and retrieve printed documents via code at a print station.",
  //       links: [{ href: "#", text: "View Code", icon: "github" }],
  //     },
  //     metrics: [
  //       { number: "—", label: ".NET + Blazor" },
  //       { number: "—", label: "Pay-per-page + color pricing" },
  //       { number: "—", label: "Secure retrieval via print code" },
  //     ],
  //     contentCards: [
  //       {
  //         markdown: `### Architecture
  // Frontend built with Blazor for interactivity; backend in .NET handles uploads, payment logic, and code generation.`,
  //       },
  //       {
  //         markdown: `### Features
  // - Upload documents.
  // - Pay dynamically by page and color.
  // - Receive a print-retrieval code.
  // - Authenticate and print at station using code.`,
  //       },
  //     ],
  //     problemSolutions: [
  //       {
  //         problem: {
  //           title: "Challenge: Secure and Easy Retrieval",
  //           issue:
  //             "Users need a seamless experience to print securely without over-sharing sensitive data.",
  //           impact: "Risk of unclaimed or misprinted documents or theft.",
  //         },
  //         solution: {
  //           title: "Solution: Unique Print Code Flow",
  //           implementation:
  //             "Generates a short code after upload + payment, gives to user; used at station to release print.",
  //           result:
  //             "Secure, contact-less retrieval and accurate accounting per user and document.",
  //         },
  //       },
  //     ],
  //     timeline: [
  //       {
  //         title: "Sprint 1: Upload & Payment",
  //         description:
  //           "Built document upload interface and pay-per-page/color calculation logic.",
  //       },
  //       {
  //         title: "Sprint 2: Code Generation & Retrieval",
  //         description:
  //           "Implemented code issuance and station validation flow for downloading documents.",
  //       },
  //     ],
  //     galleryTitle: "Printing Service UI",
  //     gallery: [
  //       {
  //         src: "/images/print-upload.png",
  //         alt: "Document upload UI",
  //         title: "Upload & Payment",
  //         description: "Upload and calculate cost before generating print code.",
  //       },
  //       {
  //         src: "/images/print-retrieve.png",
  //         alt: "Print retrieval UI",
  //         title: "Retrieve by Code",
  //         description: "Enter code at station to print your document.",
  //       },
  //     ],
  //   },
  {
    id: "ticketsage",
    header: {
      title: "TicketSage",
      subtitle: "Movie Ticket Booking Platform",
      overview:
        "TicketSage is a full-stack movie booking system built with Django REST Framework (backend) and Next.js (frontend). It integrates with the TMDB API to fetch movie data, allows users to browse listings, select seats, and book tickets, while providing an admin dashboard for cinema and booking management. My main role focused on building the backend architecture, APIs, and booking logic.",
      links: [
        {
          icon: "github",
          text: "View Code",
          href: "https://github.com/r3troseer/TicketSage",
        },
      ],
    },
    metrics: [
      { number: "100%", label: "Automated showtime scheduling" },
      { number: "200ms", label: "Avg API response time" },
      { number: "500+", label: "Test bookings processed" },
      { number: "5+", label: "Integrated APIs (TMDB, auth, booking)" },
    ],
    contentCards: [
      {
        markdown: `### System Architecture & Backend Design
- **Django + Django REST Framework** powering RESTful APIs for movies, users, bookings, and payments.
- **TMDB API integration** for real-time movie data.
- **Auto Scheduling:** Custom Django management commands to refresh movie lists and generate showtimes automatically.
- **Authentication:** Secure sign-up/login with dj-rest-auth, token-based authentication, and CSRF protection.
- **Database:** SQLite for development, with models for movies, cinemas, showtimes, and bookings.
- **Deployment:** Backend hosted on PythonAnywhere, frontend deployed on Vercel.`,
        type: ContentType.Architecture,
        tags: [
          "Django",
          "DRF",
          "SQLite",
          "TMDB API",
          "dj-rest-auth",
          "PythonAnywhere",
        ],
      },
      {
        markdown: `### Key Features & Results
- **End-User Flow:** Browse movies, view details, select seats, book tickets, and manage profile.
- **Admin Tools:** Manage cinemas, movies, showtimes, users, and bookings from a secure dashboard.
- **Frontend:** Built with Next.js and Zustand for state management; communicates with Django APIs.
- **Security:** Enforced HTTPS, password hashing, and token-based authentication.
- **Testing:** Unit, integration, and UAT all passed successfully.
- **Results:** Smooth booking process; user feedback praised ease of use but highlighted improvements needed in seat availability visibility and faster load times.`,
        type: ContentType.Features,
        tags: [
          "Next.js",
          "Zustand",
          "Vercel",
          "Admin Dashboard",
          "User Testing",
        ],
        gallery: {
          title: "TicketSage Screenshots",
          images: [
            {
              src: `${baseUrl}/image/upload/ticketsage_home.png`,
              title: "Homepage",
              description: "Movie listings with integration from TMDB API.",
            },
            {
              src: `${baseUrl}/image/upload/ticketsage_drf.png`,
              title: "DRF API",
              description: "API response showing a user’s booked movie.",
            },
          ],
        },
      },
    ],
    problemSolutions: [
      {
        problem: {
          title: "Challenge: Automated Movie & Showtime Updates",
          issue:
            "Keeping the movie catalog and showtimes fresh required constant manual input.",
          impact:
            "Admin workload increased and users risked outdated listings.",
        },
        solution: {
          title: "Solution: Custom Management Commands",
          implementation:
            "Built Django commands to fetch data from TMDB and auto-generate showtimes on a schedule.",
          result:
            "Catalog and showtimes always up-to-date with zero manual intervention.",
        },
      },
      {
        problem: {
          title: "Challenge: Seat Booking Consistency",
          issue:
            "High concurrency during booking risked double-seating issues.",
          impact: "Could result in multiple users booking the same seat.",
        },
        solution: {
          title: "Solution: Transactional Safeguards",
          implementation:
            "Used Django transactions and locks to ensure seat availability is checked and updated atomically.",
          result: "Reliable, conflict-free booking flow.",
        },
      },
    ],
    timeline: [
      {
        title: "Week 1–2: Research & Setup",
        description:
          "Defined project scope, set up Django backend, connected TMDB API.",
      },
      {
        title: "Week 3–4: Core API Development",
        description:
          "Built endpoints for movies, bookings, authentication, and users.",
      },
      {
        title: "Week 5–6: Frontend & Admin Features",
        description:
          "Integrated Next.js frontend, developed admin tools for cinemas and showtimes.",
      },
      {
        title: "Week 7–8: Testing & Deployment",
        description:
          "Conducted unit/UAT testing, deployed backend to PythonAnywhere and frontend to Vercel.",
      },
    ],
  },
];
