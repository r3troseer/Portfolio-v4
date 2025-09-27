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
              src: `${baseUrl}/studybud_architecture.png`,
              title: "System Workflow",
              description:
                "High-level design of the document processing and quiz generation pipeline.",
            },
            {
              src: `${baseUrl}/studybud_wireframe.png`,
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
              src: `${baseUrl}/studybud_summary.png`,
              title: "Summary Page",
              description:
                "Generated document summary with highlighted key points.",
            },
            {
              src: `${baseUrl}/StudyBud_Question.png`,
              title: "Quiz Page",
              description:
                "Interactive quizzes generated from uploaded documents.",
            },
            {
              src: `${baseUrl}/StudyBud_Result_and_Feedback.png`,
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
        title: "Week 1-2: Research & Setup",
        description:
          "Explored NLP libraries, compared PDF/DOCX extraction tools, and set up Django project.",
      },
      {
        title: "Week 3-4: Core Pipeline",
        description:
          "Implemented document upload, PyMuPDF/docx2txt integration, and summarization pipeline.",
      },
      {
        title: "Week 5-6: AI Integration",
        description:
          "Integrated GPT models, built quiz generation, added caching and chunking strategies.",
      },
      {
        title: "Week 7-8: Testing & UI",
        description:
          "Refined UI/UX, integrated user accounts, gathered feedback, and optimized performance.",
      },
    ],
  },

  {
    id: "eprep",
    header: {
      title: "EPrep",
      subtitle: "API-Driven Exam Preparation Platform",
      overview:
        "EPrep is an unfinished but feature-rich Django REST Framework backend designed to power a mobile-first exam preparation service. It provides secure authentication with OTP, exam/practice APIs, and Paystack-powered payments. While not production-ready, it demonstrates modern backend architecture and real-world integrations suitable for scaling.",
      links: [
        {
          icon: "github",
          text: "View Code",
          href: "https://github.com/r3troseer/EPrep",
        },
      ],
      badge: { text: "MVP", type: "mvp", size: "small" },
    },
    metrics: [
      { number: "4", label: "Core Apps (api, users, payment, otp)" },
      { number: "2", label: "OTP Providers Integrated (Termii, Twilio)" },
      { number: "100%", label: "API-First Design" },
      { number: "MVP", label: "Development Stage" },
    ],
    contentCards: [
      {
        markdown: `### Backend Architecture
- **Framework:** Django 4.1 + Django REST Framework.
- **Authentication:** JWT tokens via SimpleJWT, with social login (django-allauth + dj-rest-auth).
- **Apps:**
  - \`users\`: Registration, login, password reset.
  - \`api\`: Core exam/practice APIs.
  - \`payment\`: Paystack integration for subscriptions.
  - \`otp\`: OTP verification with Termii/Twilio.
- **Config & Secrets:** Managed via python-decouple.
- **Database:** SQLite in dev; Postgres/MySQL ready for production.`,
        type: ContentType.Architecture,
        tags: ["Django", "DRF", "JWT", "Paystack", "Termii", "Twilio"],
      },
      {
        markdown: `### Features & Current Status
- **User Management:** Secure signup/login, password reset, social login.
- **Payments:** Paystack integration with transaction records.
- **OTP Security:** SMS/email OTP for secure authentication.
- **Exam APIs:** Partially implemented, designed for question/answer flow.
- **Status:** Backend MVP complete, Flutter frontend in progress, no live deployment yet.`,
        type: ContentType.Features,
        tags: ["API-First", "Mobile Backend", "Authentication", "Payments"],
        gallery: {
          title: "EPrep (Figma UI)",
          images: [
            {
              src: "/images/eprep-login.png",
              title: "Login UI (Figma)",
              description: "Secure login and OTP verification flow.",
            },
            {
              src: "/images/eprep-dashboard.png",
              title: "Dashboard (Figma)",
              description: "Planned exam/practice dashboard for students.",
            },
          ],
        },
      },
    ],
    problemSolutions: [
      {
        problem: {
          title: "Challenge: Secure Authentication",
          issue: "Needed strong user authentication beyond simple passwords.",
          impact: "Risk of unauthorized access and weak security flows.",
        },
        solution: {
          title: "Solution: JWT + OTP",
          implementation:
            "Implemented JWT authentication with dj-rest-auth and Termii/Twilio OTP verification.",
          result: "Modern, secure login ready for mobile integration.",
        },
      },
      {
        problem: {
          title: "Challenge: Monetization",
          issue: "Required payment flow for unlocking premium content.",
          impact: "No sustainable model without transactions.",
        },
        solution: {
          title: "Solution: Paystack Integration",
          implementation:
            "Integrated Paystack APIs and transaction recording in the `payment` app.",
          result: "Supports subscriptions/credits with audit trail.",
        },
      },
    ],
    timeline: [
      {
        title: "Week 1: Setup",
        description: "Configured Django + DRF with modular apps.",
      },
      {
        title: "Week 2-3: Authentication",
        description: "Implemented JWT + dj-rest-auth with OTP verification.",
      },
      {
        title: "Week 4: Payments",
        description: "Integrated Paystack APIs and transaction models.",
      },
      {
        title: "Week 5: Exam APIs",
        description: "Scaffolded endpoints for practice questions.",
      },
      {
        title: "Ongoing",
        description: "Flutter frontend in progress, deployment pending.",
      },
    ],
  },

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
      badge: { text: "Live", type: "live", size: "small" },
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
              src: `${baseUrl}/UK_shift_calculator_home`,
              title: "Dashboard",
              description: "Main interface with time clock and shift tracking.",
            },
            {
              src: `${baseUrl}/UK_shift_calculator_summary`,
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
            "Users couldn't rely on generic calculators for accurate take-home pay.",
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
        title: "Week 2-3: Core Development",
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
  {
    id: "train-booking",
    header: {
      title: "TBS-SeatBooking",
      subtitle: "A Clean Architecture .NET 8 train seat booking system",
      overview:
        "TBS-SeatBooking is a reservation system built with .NET 8 Web API following Clean Architecture principles. It manages routes, schedules, real-time seat availability, bookings, and payments while providing OTP-based authentication for a frictionless user experience.",
      links: [],
      badge: { text: "Private", type: "private", size: "small" },
    },
    metrics: [
      { number: "500+", label: "Seats managed per schedule" },
      { number: "99.9%", label: "Conflict-free booking reliability" },
      { number: "<150ms", label: "Average seat availability check" },
    ],
    contentCards: [
      {
        markdown: `
### Architecture & Core Features

The system follows **Clean Architecture** with strict separation of concerns:

- **Core Domain** → Entities like \`TripSchedule\`, \`Seat\`, \`Booking\`, \`Transaction\`.  
- **Application Layer** → Use cases (\`TripScheduleUseCase\`, \`BookingUseCase\`), DTOs, AutoMapper.  
- **Infrastructure Layer** → MySQL persistence & repository implementations.  
- **Presentation Layer** → ASP.NET Web API controllers with Swagger docs.  
  
#### Core Capabilities:
- Trip management (routes, stops, schedules).  
- Real-time seat availability (STD, BUS, VIP).  
- Booking flow: seat assignment, contacts, order time.  
- Transactions with booking linkage, metadata & status.  
- Passwordless login with OTP (email/SMS).  
      `,
        type: ContentType.Architecture,
        tags: ["Architecture", ".NET 8", "Clean Architecture", "API"],
      },
      {
        markdown: `
### My Contributions

- **OTP Authentication:** Designed and implemented passwordless login/register via OTP for frictionless onboarding.  
- **Stop Logic Refactor:** Decoupled stop retrieval from repositories, moving mapping to service layer → easier to test & extend.  
- **Booking Enhancements:** Built the \`TripBooking\` model, added merging logic, and conflict prevention in seat allocation.  
- **Transactions:** Implemented persistence (\`transactionId\`, \`bookingId\`, \`refId\`, status) and ensured reconciliation with bookings.  

#### Impact:
- Simplified user onboarding with OTP.  
- Improved maintainability of schedule & stop logic.  
- Prevented overlapping seat bookings → improved reliability.  
- Scalable due to persistence abstraction & clean separation.  
      `,
        type: ContentType.Features,
        tags: ["OTP", "Transactions", "Booking", "Seat Logic"],
      },
    ],
    problemSolutions: [
      {
        problem: {
          title: "Stop Logic Complexity",
          issue:
            "Stop retrieval was tightly coupled inside repository methods, mixing persistence with domain mapping.",
          impact:
            "Testing was difficult, and any change in stop logic risked breaking repository code.",
        },
        solution: {
          title: "Refactor Stop Retrieval",
          implementation:
            "Split stop retrieval into dedicated repository methods and moved mapping into the service layer.",
          result:
            "Improved testability and flexibility, stop logic can now evolve independently of persistence.",
        },
      },
      {
        problem: {
          title: "Seat Allocation Conflicts",
          issue:
            "Simultaneous booking requests could assign the same seat before payment was confirmed.",
          impact:
            "This risked double-bookings, leading to customer frustration and financial errors.",
        },
        solution: {
          title: "Conflict-Free Booking Flow",
          implementation:
            "Enhanced booking logic to merge seat requests, validate seat availability, and tie allocation directly to payment status.",
          result:
            "No more overlapping reservations; users can only confirm seats after valid payment.",
        },
      },
    ],
    timeline: [
      {
        title: "2024-09",
        description:
          "Initialized .NET 8 Clean Architecture solution with Core, Infrastructure, and WebAPI layers.",
      },
      {
        title: "2024-10",
        description:
          "Implemented booking flow, seat availability checks, and transaction persistence.",
      },
      {
        title: "2024-11",
        description:
          "Added OTP-based authentication and improved SeatAvailabilityDto with enums.",
      },
      {
        title: "2024-12",
        description:
          "Refactored stop logic into repositories + services. Released MVP internally.",
      },
      {
        title: "2025-01",
        description:
          "Extended booking flow with email ticket notifications and payment reconciliation.",
      },
    ],
  },

  {
    id: "printing-service",
    header: {
      title: "OPS — Online Printing Service",
      subtitle: "Clean Architecture .NET Backend + Blazor Frontend",
      overview:
        "OPS is a full-stack solution for document printing services, built with ASP.NET Core Web API and a Blazor Server UI. It allows users to upload documents, pay online, and retrieve a unique code for printing at a physical station. The system uses a Clean architecture with MongoDB/MySQL persistence, Redis caching, Azure Blob storage, and JWT-based authentication.",
      links: [],
      badge: { text: "Private", type: "private", size: "small" },
    },
    metrics: [
      { number: "100+", label: "Documents printed" },
      { number: "3+", label: "Storage Backends (MongoDB, MySQL, SQLite)" },
      { number: "100%", label: "Clean Architecture" },
      { number: "Redis + Azure", label: "Caching & File Storage" },
    ],
    contentCards: [
      {
        markdown: `### Architecture & Backend
- **Clean Architecture:** Core (domain & use cases), Infrastructure (repositories, persistence), WebAPI (controllers).
- **Persistence:** Supports MongoDB, MySQL, and SQLite with repository pattern.
- **Caching:** Redis integration for performance.
- **File Storage:** Azure Blob storage for uploaded documents.
- **Auth:** Custom JWT authentication with token validation via IdentityManager.
- **Use Cases:** Organized under Core/Application/Services for accounts, print jobs, and payments.
- **Testing:** Separate Core and Infrastructure test projects ensure business logic is verifiable.`,
        type: ContentType.Architecture,
        tags: [
          "ASP.NET Core",
          "Clean Architecture",
          "MongoDB",
          "Redis",
          "Azure Blob Storage",
        ],
      },
      {
        markdown: `### Features & User Experience
- **User Workflow:** Upload a document → Pay online → Receive a unique code → Print at a station.
- **Payments:** Integrated payment processing with transaction tracking.
- **Blazor Server UI:** Components for login, upload, payment confirmation, and job management.
- **Queueing:** Background job consumer processes print jobs asynchronously.
- **Admin Tools:** API endpoints and Blazor components for managing users, jobs, and transactions.
- **Security:** JWT token-based authentication with OTP support.`,
        type: ContentType.Features,
        tags: ["Blazor Server", "JWT Auth", "Payments", "Background Jobs"],
        gallery: {
          title: "OPS Screenshots",
          images: [
            {
              src: "/images/ops-upload.png",
              title: "Upload Document",
              description:
                "Blazor component for uploading and managing documents.",
            },
            {
              src: "/images/ops-payment.png",
              title: "Payment Confirmation",
              description: "Payment workflow integrated with backend services.",
            },
          ],
        },
      },
    ],
    problemSolutions: [
      {
        problem: {
          title: "Challenge: Duplicate File Uploads",
          issue: "Users repeatedly uploaded the same documents for reprints.",
          impact: "Wasted storage and cluttered user workflow.",
        },
        solution: {
          title: "Solution: Document Reuse",
          implementation:
            "Built a 'My Documents' page so users can reselect past uploads instead of re-uploading.",
          result:
            "Reduced storage use, simplified reprints, and improved overall UX.",
        },
      },
      {
        problem: {
          title: "Challenge: Passwordless Authentication",
          issue:
            "Passwords added friction and risk without real security value.",
          impact: "Slower onboarding and potential weak password issues.",
        },
        solution: {
          title: "Solution: OTP-Based Login/Register",
          implementation:
            "Replaced passwords with one-time codes for both login and new device registration.",
          result:
            "Faster onboarding, no password resets, and secure identity across devices.",
        },
      },
    ],
    timeline: [
      {
        title: "Phase 1: Architecture & Setup",
        description:
          "Established Clean structure, Core, Infrastructure, and WebAPI projects.",
      },
      {
        title: "Phase 2: Authentication & Print Jobs",
        description:
          "Implemented JWT auth, account workflows, and print job domain logic.",
      },
      {
        title: "Phase 3: Storage & Payments",
        description:
          "Added Azure Blob storage and payment processing workflow.",
      },
      {
        title: "Phase 4: UI & Background Jobs",
        description:
          "Built Blazor UI components and job consumer for print processing.",
      },
      {
        title: "Phase 5: Testing & Optimization",
        description:
          "Wrote Core/Infrastructure tests and integrated Redis caching.",
      },
    ],
  },

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
              src: `${baseUrl}/ticketsage_home.png`,
              title: "Homepage",
              description: "Movie listings with integration from TMDB API.",
            },
            {
              src: `${baseUrl}/ticketsage_drf.png`,
              title: "DRF API",
              description: "API response showing a user's booked movie.",
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
        title: "Week 1-2: Research & Setup",
        description:
          "Defined project scope, set up Django backend, connected TMDB API.",
      },
      {
        title: "Week 3-4: Core API Development",
        description:
          "Built endpoints for movies, bookings, authentication, and users.",
      },
      {
        title: "Week 5-6: Frontend & Admin Features",
        description:
          "Integrated Next.js frontend, developed admin tools for cinemas and showtimes.",
      },
      {
        title: "Week 7-8: Testing & Deployment",
        description:
          "Conducted unit/UAT testing, deployed backend to PythonAnywhere and frontend to Vercel.",
      },
    ],
  },
];
