import { UserProfile } from '@/types/profile';

export const defaultProfile: UserProfile = {
  personalInfo: {
    fullName: 'Md Farhan Hossain',
    preferredName: 'Farhan',
    headline: 'Self-taught Software Developer & AI Builder',
    bio: 'Self-taught Software Developer and AI Builder focused on AI engineering, software development, and cloud technologies. Began programming in March 2026 and progressed from foundational HTML/CSS into modern web development, AI/LLM application development, automation, computer vision, local RAG systems, and multi-provider AI orchestration through intensive independent learning and project-based development. Builds and personally uses full applications rather than limiting development to tutorials or isolated experiments. Experienced in designing AI-powered systems, local-first applications, structured data architectures, browser automation, native Android integrations, and safety-conscious agent workflows. Known for being self-directed, adaptable, fast-learning, and persistent when working with unfamiliar technologies. Dedicates approximately 6 hours per day to programming and development.',
    email: 'farhan.sajid1896@gmail.com',
    location: 'Dhaka, Bangladesh',
    links: {
      github: 'https://github.com/farhanfreak9137-ai',
      linkedin: '',
      portfolio: 'https://portfolio-two-chi-dgvbedq05m.vercel.app/',
      twitter: '',
    },
  },
  careerPreferences: {
    targetRoles: [
      'AI Engineer',
      'Software Engineer',
      'Cloud Engineer',
      'Full-Stack Developer',
      'Frontend Developer',
      'AI-powered Application Developer',
      'Intelligent Automation Developer',
      'Developer Tools & Agent Systems Engineer',
    ],
    preferredIndustries: [
      'Artificial Intelligence & Developer Tools',
      'Intelligent Automation & Productivity Systems',
      'Cloud Engineering & Full-Stack Applications',
    ],
    workModel: 'remote',
    preferredLocations: ['Remote (Worldwide)', 'Remote (US/EU/Asia Timezones)', 'Dhaka, Bangladesh'],
    noticePeriodDays: 14,
    shortTermGoals: [
      'Master advanced AI agent architectures, multi-provider model failover, and local-first systems.',
      'Deploy production-ready full-stack and autonomous agent applications.',
      'Continue intensive self-directed engineering learning (~6 hours daily) and open-source building.',
    ],
    longTermGoals: [
      'Lead engineering of high-impact AI systems, intelligent automation, and developer platforms.',
      'Innovate in local-first, privacy-preserving AI, agentic systems, and computer vision applications.',
    ],
    coreValues: [
      'Self-Directed Learning & Practical Building (Build and personally use full applications)',
      'Adaptability & Extreme Persistence with Unfamiliar Technologies',
      'Safety-Conscious Agent Design & Zero-BS Clean Code',
      'High Engineering Craftsmanship & Problem-Solving Mindset',
    ],
  },
  skills: [
    {
      category: 'Languages & Core',
      skills: [
        { name: 'TypeScript', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'JavaScript (ESNext)', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Python', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Java', proficiency: 'intermediate', yearsOfExperience: 1, highlight: false },
        { name: 'HTML5 & CSS3', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Vanilla CSS', proficiency: 'expert', yearsOfExperience: 1, highlight: false },
        { name: 'SQL', proficiency: 'intermediate', yearsOfExperience: 1, highlight: false },
      ],
    },
    {
      category: 'AI, LLMs & Agentic Systems',
      skills: [
        { name: 'Multi-Model AI Orchestration', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Google Gemini SDK', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Groq Cloud LPUs', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'OpenAI APIs & OpenRouter', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Ollama & Local LLMs', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Retrieval-Augmented Generation (RAG)', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Vector Similarity Search', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'AI Tool Calling & Function Calling', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Structured LLM Outputs (Zod)', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'AI Safety & Human-in-the-Loop Workflows', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Prompt Engineering', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Computer Vision Concepts (WebRTC / Canvas analysis)', proficiency: 'intermediate', yearsOfExperience: 1, highlight: true },
      ],
    },
    {
      category: 'Frameworks & Web Development',
      skills: [
        { name: 'Next.js 16 (App Router & Turbopack)', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'React 19', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Vite', proficiency: 'advanced', yearsOfExperience: 1, highlight: false },
        { name: 'Tailwind CSS (v3 & v4)', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'Framer Motion', proficiency: 'intermediate', yearsOfExperience: 1, highlight: false },
        { name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'REST & Streaming APIs', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'KaTeX & LaTeX Preprocessing', proficiency: 'advanced', yearsOfExperience: 1, highlight: false },
        { name: 'Zustand State Management', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
      ],
    },
    {
      category: 'Databases, Mobile & Automation',
      skills: [
        { name: 'SQLite & Drizzle ORM', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
        { name: 'PostgreSQL & Prisma', proficiency: 'intermediate', yearsOfExperience: 1, highlight: false },
        { name: 'Firebase Cloud Firestore', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Supabase', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Playwright Browser Automation', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Windows PowerShell, CMD & Win32 API', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Capacitor & Native Android Integration', proficiency: 'intermediate', yearsOfExperience: 1, highlight: true },
        { name: 'Git & GitHub', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Vercel & Netlify Deployment', proficiency: 'advanced', yearsOfExperience: 1, highlight: false },
        { name: 'Local-First / Offline-First Architecture', proficiency: 'expert', yearsOfExperience: 1, highlight: true },
      ],
    },
  ],
  experience: [
    {
      id: 'exp-1',
      role: 'Checkout Assistant / POS Cashier',
      company: 'Shwapno',
      location: 'Dhaka, Bangladesh',
      employmentType: 'full-time',
      startDate: '2025-07',
      endDate: '2025-12',
      current: false,
      summary: 'Operated POS checkout systems and processed customer transactions in a fast-paced retail environment.',
      achievements: [
        'Operated POS checkout systems and processed customer transactions accurately in a fast-paced retail environment.',
        'Managed checkout responsibilities while maintaining professionalism and strong customer-facing communication.',
        'Developed practical experience in workplace responsibility, time management, and adapting to operational requirements.',
        'Concluded the role in December 2025 to dedicate focused attention to academic studies and software engineering.',
      ],
      technologiesUsed: ['POS Checkout Systems', 'Retail Operations', 'Customer Service'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'Pallabi Government College',
      degree: 'Higher Secondary Certificate (HSC)',
      fieldOfStudy: 'Science (2nd Year — Expected 2027)',
      startDate: '2025',
      endDate: '2027',
      gradeOrGpa: 'Currently pursuing 2nd Year',
      highlights: [
        'Currently pursuing HSC-level studies in the Science stream.',
        'Independently studying AI engineering, software architecture, and practical application building.',
      ],
    },
    {
      id: 'edu-2',
      institution: 'Milestone College',
      degree: 'Higher Secondary Certificate (HSC)',
      fieldOfStudy: 'Science (1st Year)',
      startDate: '2024',
      endDate: '2025',
      gradeOrGpa: 'Completed 1st Year',
      highlights: [
        'Foundational science studies in Physics, Chemistry, Higher Mathematics, and ICT.',
      ],
    },
    {
      id: 'edu-3',
      institution: 'MDC Model School & College',
      degree: 'Secondary School Certificate (SSC)',
      fieldOfStudy: 'Science',
      startDate: '2023',
      endDate: '2025',
      gradeOrGpa: 'GPA 4.11 / 5.0',
      highlights: [
        'Completed SSC examination in Science stream with GPA 4.11.',
      ],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'Auren — Personal Career Operating System & Autonomous Desktop Copilot',
      description: 'Local-first personal AI career operating system and desktop agent orchestrator designed around multi-provider AI failover, grounded personal knowledge, audited automation, and human approval boundaries.',
      role: 'Creator & Lead Architect',
      technologies: [
        'Next.js 16',
        'React 19',
        'TypeScript',
        'Google Gemini SDK',
        'OpenAI SDK',
        'Groq',
        'Ollama',
        'Python',
        'Playwright',
        'SQLite',
        'Drizzle ORM',
        'Zod',
        'PowerShell',
        'Win32 API',
      ],
      outcomesOrImpact: [
        'Designed a centralized AI assistant orchestrator capable of dynamically registering and exposing 58 tools for multi-step function calling.',
        'Built a multi-tier AI failover architecture rotating across 3 Gemini API keys, Groq Cloud LPUs (qwen/qwen3.8-27b), and local Ollama (qwen2.5:1.5b) when rate limits occur.',
        'Developed intent-based tool pruning that reduces exposed tools per request, slashing prompt-token overhead by 65%-82%.',
        'Implemented an offline Windows fast-path for desktop and system operations in <20ms without consuming cloud tokens.',
        'Built human-in-the-loop approval system, verified personal memory with confidence scoring, and audited Playwright browser automation with SSRF protection.',
      ],
      githubUrl: 'https://github.com/farhanfreak9137-ai',
      liveUrl: 'http://localhost:3000',
      featured: true,
    },
    {
      id: 'proj-2',
      title: 'Atlas — Personal AI Operating System & Digital Discipline Platform',
      description: 'Cross-platform productivity and personal discipline platform combining life tracking, contextual AI assistance, native Android controls, and computer-vision-based physical verification.',
      role: 'Lead Developer & Architect',
      technologies: [
        'Next.js 16',
        'React 19',
        'TypeScript',
        'Tailwind CSS',
        'Zustand',
        'Supabase',
        'Firebase Firestore',
        'OpenRouter',
        'Gemini',
        'WebRTC',
        'HTML5 Canvas',
        'Capacitor',
        'Java',
      ],
      outcomesOrImpact: [
        'Developed a native Android Capacitor plugin integrating UsageStatsManager and system overlay capabilities to enforce application-level screen-time restrictions.',
        'Built a WebRTC-based computer-vision system using camera frames and Canvas luminance analysis to detect and verify push-up repetitions.',
        'Created a context-ingestion engine combining tasks, habits, study sessions, gym records, journals, and personal metrics into structured AI context.',
        'Designed modular state architecture using 15 Zustand domain stores with multi-provider persistence (LocalStorage + Supabase PostgreSQL + Firebase Cloud Firestore).',
        'Built unified dashboard covering tasks, habits, study tracking, GPA, gym training, football performance, notes, and journaling.',
      ],
      githubUrl: 'https://github.com/farhanfreak9137-ai',
      liveUrl: 'https://portfolio-two-chi-dgvbedq05m.vercel.app/',
      featured: true,
    },
    {
      id: 'proj-3',
      title: 'HSC AI Study Intelligence System',
      description: 'Evidence-based study prioritization, Socratic AI tutoring, question-pattern analysis, and exam simulation platform designed for Bangladesh HSC Science students.',
      role: 'Creator & Lead Developer',
      technologies: [
        'React 19',
        'TypeScript',
        'Vite',
        'Tailwind CSS 4',
        'KaTeX',
        'Zustand',
        'Google Gemini SDK',
        'OpenRouter',
        'Playwright',
        'Capacitor',
      ],
      outcomesOrImpact: [
        'Designed a dynamic topic-priority algorithm combining historical board-question recurrence with individual student weakness data to identify high-priority study areas.',
        'Built a multi-model AI provider layer using Gemini and OpenRouter fallbacks with structured JSON output validation.',
        'Developed a Bengali/LaTeX preprocessing pipeline capable of normalizing mixed Bengali text and mathematical notation for responsive KaTeX rendering.',
        'Created a question-synthesis engine generating NCTB-style creative questions/MCQs and an all-board historical examination question bank.',
        'Implemented timed board-exam simulator, printable PDF model paper generation, and a diagnostic "Mistake Vault" distinguishing conceptual gaps from calculation mistakes.',
      ],
      githubUrl: 'https://github.com/farhanfreak9137-ai',
      liveUrl: '',
      featured: true,
    },
    {
      id: 'proj-4',
      title: 'Gym Tracker',
      description: 'Offline-first workout logging and analytics application for structured training, progressive overload tracking, and workout performance analysis.',
      role: 'Sole Developer',
      technologies: [
        'React',
        'TypeScript',
        'Tailwind CSS',
        'LocalStorage',
        'SVG',
        'Client-side Architecture',
      ],
      outcomesOrImpact: [
        'Built a customizable workout split and routine-management system supporting multiple training structures.',
        'Developed a touch-optimized active workout logger for rapid set, repetition, and weight entry.',
        'Implemented background-resilient rest timer using absolute timestamps to prevent timing drift when browser tabs are suspended.',
        'Built lightweight SVG-based analytics for training volume, muscle-group distribution, and personal-record progression.',
      ],
      githubUrl: 'https://github.com/farhanfreak9137-ai',
      liveUrl: '',
      featured: false,
    },
    {
      id: 'proj-5',
      title: 'Personal AI Chatbot',
      description: 'Personalized AI conversational application developed as an early exploration of LLM-powered applications, configurable AI personality, and persistent conversational memory.',
      role: 'Developer',
      technologies: ['JavaScript', 'HTML5/CSS3', 'AI APIs', 'Conversational State'],
      outcomesOrImpact: [
        'Built as the first major AI application in April 2026 after beginning programming in March 2026.',
        'Explored persistent conversational context and personalized AI behavior.',
        'Used as a foundation for progressing into larger agent architectures, local RAG systems, and multi-provider orchestration.',
      ],
      githubUrl: 'https://github.com/farhanfreak9137-ai',
      liveUrl: '',
      featured: false,
    },
  ],
  documents: [
    {
      id: 'doc-cv-farhan',
      title: 'Md Farhan Hossain — Official Resume & Career Document',
      type: 'cv',
      content: `# Md Farhan Hossain
Location: Dhaka, Bangladesh | Phone: +880 1346-859137 | Email: farhan.sajid1896@gmail.com
GitHub: https://github.com/farhanfreak9137-ai | Portfolio: https://portfolio-two-chi-dgvbedq05m.vercel.app/

## Summary
Self-taught Software Developer and AI Builder focused on AI engineering, software development, and cloud technologies. Began programming in March 2026 and progressed from foundational HTML/CSS into modern web development, AI/LLM application development, automation, computer vision, local RAG systems, and multi-provider AI orchestration through intensive independent learning and project-based development. Builds and personally uses full applications rather than limiting development to tutorials or isolated experiments. Experienced in designing AI-powered systems, local-first applications, structured data architectures, browser automation, native Android integrations, and safety-conscious agent workflows. Known for being self-directed, adaptable, fast-learning, and persistent when working with unfamiliar technologies. Dedicates approximately 6 hours per day to programming, development, and technical learning.

## Education
- Pallabi Government College: Higher Secondary Certificate (HSC), Science stream (2nd Year — Expected 2027)
- Milestone College: Higher Secondary Certificate (HSC), Science (1st Year)
- MDC Model School & College: Secondary School Certificate (SSC), Science (2025 | GPA: 4.11 / 5.0)

## Work Experience
- Checkout Assistant / POS Cashier — Full-Time (July 30, 2025 – December 20, 2025)
  Company: Shwapno, Dhaka, Bangladesh
  • Operated POS checkout systems and processed customer transactions in a retail environment.
  • Managed checkout responsibilities while maintaining accuracy and customer-facing professionalism.
  • Worked within a fast-paced retail environment requiring attention to detail and reliable day-to-day execution.
  • Developed practical experience in workplace responsibility, customer interaction, time management, and operational requirements.
  • Left the position to focus more heavily on academic performance and software engineering.

## Major Projects
1. Auren — Personal Career Operating System & Autonomous Desktop Copilot
   Stack: Next.js 16, React 19, TypeScript, Google Gemini SDK, OpenAI SDK, Groq, Ollama, Python, Playwright, SQLite, Drizzle ORM, Zod, PowerShell, Win32 API.
   Features: 58-tool orchestrator, 3-key Gemini rotation pool, Groq LPU failover, offline Windows fast-path (<20ms), intent tool pruning (-65% tokens), human approval safeguards, RAG, Playwright browser control.

2. Atlas — Personal AI Operating System & Digital Discipline Platform
   Stack: Next.js 16, React 19, TypeScript, Tailwind CSS, Zustand, Supabase, Firebase Cloud Firestore, OpenRouter, Gemini, Llama, WebRTC, HTML5 Canvas, Capacitor, Java.
   Features: Native Android plugin with UsageStatsManager for app screen-time restrictions, WebRTC computer-vision push-up repetition counter, 15 Zustand domain stores, multi-provider persistence, unified life tracking.

3. HSC AI Study Intelligence System
   Stack: React 19, TypeScript, Vite, Tailwind CSS 4, KaTeX, Zustand, Google Gemini SDK, OpenRouter, Playwright, Capacitor.
   Features: NCTB question synthesis, dynamic topic prioritization, historical board-question bank, timed board-exam simulator, diagnostic Mistake Vault, LaTeX/Bengali math rendering.

4. Gym Tracker
   Stack: React, TypeScript, Tailwind CSS, LocalStorage, client-side data architecture, SVG.
   Features: Workout split manager, rapid logging, background-resilient rest timer, SVG volume analytics, PR comparisons.

5. Personal AI Chatbot
   First major AI project built in April 2026 exploring persistent memory and conversational LLM integration.

## Languages
- Bengali: Native
- English: Fluent
- Hindi: Fluent`,
      addedAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
};
