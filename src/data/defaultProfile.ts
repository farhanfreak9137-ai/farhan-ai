import { UserProfile } from '@/types/profile';

export const defaultProfile: UserProfile = {
  personalInfo: {
    fullName: 'Farhan',
    preferredName: 'Farhan',
    headline: 'AI Software Engineer & Full-Stack Systems Architect',
    bio: 'Software engineer specializing in modern TypeScript/Next.js architectures, AI agent orchestration, and high-performance web systems. Passionate about autonomous agents, developer tooling, and career acceleration platforms.',
    email: 'farhan@example.com',
    location: 'Dhaka, Bangladesh',
    links: {
      github: 'https://github.com/farhan',
      linkedin: 'https://linkedin.com/in/farhan',
      portfolio: 'https://farhan.dev',
      twitter: '',
    },
  },
  careerPreferences: {
    targetRoles: [
      'AI Software Engineer',
      'Senior Full-Stack Engineer',
      'AI Systems Architect',
      'Agentic Systems Developer',
    ],
    preferredIndustries: [
      'Artificial Intelligence & Developer Tools',
      'Enterprise SaaS',
      'Tech & Productivity',
    ],
    workModel: 'remote',
    preferredLocations: ['Remote (Worldwide)', 'Remote (US/EU/Asia Timezones)'],
    noticePeriodDays: 30,
    shortTermGoals: [
      'Master agentic tool calling, autonomous workflows, and production RAG pipelines.',
      'Deploy Farhan AI as a fully functioning personal career operating system.',
      'Publish high-impact technical articles and open-source agent projects.',
    ],
    longTermGoals: [
      'Lead AI architecture for cutting-edge autonomous software agents.',
      'Build scalable multi-agent systems serving thousands of developers.',
      'Continuously innovate at the intersection of web frameworks and large language models.',
    ],
    coreValues: [
      'Engineering Craftsmanship & Zero-BS Code',
      'Extreme Ownership & Autonomy',
      'Rapid Continuous Learning',
      'High Practical Impact & User Value',
    ],
  },
  skills: [
    {
      category: 'Languages & Core',
      skills: [
        { name: 'TypeScript', proficiency: 'advanced', yearsOfExperience: 4, highlight: true },
        { name: 'JavaScript (ESNext)', proficiency: 'expert', yearsOfExperience: 5, highlight: true },
        { name: 'Python', proficiency: 'advanced', yearsOfExperience: 3, highlight: true },
        { name: 'SQL', proficiency: 'advanced', yearsOfExperience: 4, highlight: false },
        { name: 'HTML5 & Modern CSS', proficiency: 'expert', yearsOfExperience: 5, highlight: false },
      ],
    },
    {
      category: 'AI & Agentic Systems',
      skills: [
        { name: 'LLM Orchestration & Prompt Engineering', proficiency: 'advanced', yearsOfExperience: 2, highlight: true },
        { name: 'Function & Tool Calling', proficiency: 'advanced', yearsOfExperience: 2, highlight: true },
        { name: 'RAG & Vector Context Injection', proficiency: 'advanced', yearsOfExperience: 2, highlight: true },
        { name: 'Multi-Model Fallbacks & Routing', proficiency: 'advanced', yearsOfExperience: 1, highlight: true },
        { name: 'Agent Memory & State Management', proficiency: 'intermediate', yearsOfExperience: 1, highlight: false },
      ],
    },
    {
      category: 'Frameworks & Web',
      skills: [
        { name: 'Next.js (App Router)', proficiency: 'advanced', yearsOfExperience: 3, highlight: true },
        { name: 'React', proficiency: 'expert', yearsOfExperience: 4, highlight: true },
        { name: 'Node.js', proficiency: 'advanced', yearsOfExperience: 4, highlight: true },
        { name: 'Express / Fastify', proficiency: 'advanced', yearsOfExperience: 3, highlight: false },
        { name: 'REST & Streaming APIs', proficiency: 'expert', yearsOfExperience: 4, highlight: true },
      ],
    },
    {
      category: 'Databases & Infrastructure',
      skills: [
        { name: 'PostgreSQL', proficiency: 'advanced', yearsOfExperience: 3, highlight: true },
        { name: 'Redis', proficiency: 'intermediate', yearsOfExperience: 2, highlight: false },
        { name: 'Docker', proficiency: 'intermediate', yearsOfExperience: 2, highlight: false },
        { name: 'Git & GitHub Actions', proficiency: 'advanced', yearsOfExperience: 4, highlight: true },
        { name: 'Vercel & Cloudflare Workers', proficiency: 'advanced', yearsOfExperience: 2, highlight: false },
      ],
    },
  ],
  experience: [
    {
      id: 'exp-1',
      role: 'Full-Stack & AI Engineer',
      company: 'Tech Solutions Studio',
      location: 'Remote',
      employmentType: 'full-time',
      startDate: '2023-01',
      current: true,
      summary: 'Architecting modern web applications, LLM-powered internal tools, and high-performance TypeScript microservices.',
      achievements: [
        'Designed and implemented autonomous AI assistant workflows reducing customer inquiry response times by 45%.',
        'Led migration of frontend applications to Next.js App Router, boosting page load speeds and SEO Core Web Vitals.',
        'Engineered streaming REST endpoints with real-time SSE updates for concurrent users.',
        'Mentored junior engineers on clean TypeScript patterns, strict type-safety, and test-driven development.',
      ],
      technologiesUsed: ['TypeScript', 'Next.js', 'React', 'Node.js', 'PostgreSQL', 'OpenAI API', 'Docker'],
    },
    {
      id: 'exp-2',
      role: 'Software Developer',
      company: 'Digital Innovation Labs',
      location: 'Dhaka',
      employmentType: 'full-time',
      startDate: '2021-06',
      endDate: '2022-12',
      current: false,
      summary: 'Developed robust client-facing web portals and scalable backend database pipelines.',
      achievements: [
        'Built full-stack dashboards using React, Node.js, and PostgreSQL for enterprise clients.',
        'Implemented authentication, RBAC authorization, and automated regression test pipelines.',
        'Optimized database queries and indexing strategies, slashing query latencies by 35%.',
      ],
      technologiesUsed: ['JavaScript', 'React', 'Node.js', 'Express', 'PostgreSQL', 'Git'],
    },
  ],
  education: [
    {
      id: 'edu-1',
      institution: 'University of Engineering and Technology',
      degree: 'Bachelor of Science',
      fieldOfStudy: 'Computer Science & Engineering',
      startDate: '2017',
      endDate: '2021',
      gradeOrGpa: '3.8 / 4.0',
      highlights: [
        'Major focus on Data Structures, Algorithms, Software Architecture, and Distributed Systems.',
        'Undergraduate Thesis: Intelligent automated decision support systems.',
      ],
    },
  ],
  projects: [
    {
      id: 'proj-1',
      title: 'Farhan AI — Personal AI Career Operating System',
      description: 'An intelligent personal AI agent with swappable LLM providers, multi-API failover, structured memory, and strict anti-hallucination career grounding.',
      role: 'Creator & Lead Architect',
      technologies: ['TypeScript', 'Next.js', 'App Router', 'Zod', 'Gemini API', 'OpenAI API'],
      outcomesOrImpact: [
        'Supports multi-provider LLM failover with automatic fallback to prevent rate limits.',
        'Enforces strict factual boundaries: AI never hallucinates or fabricates background details.',
        'Full document ingestion and context-aware career Q&A capability.',
      ],
      githubUrl: 'https://github.com/farhan/farhan-ai',
      liveUrl: '',
      featured: true,
    },
    {
      id: 'proj-2',
      title: 'Autonomous Workflow & Agent Orchestrator',
      description: 'An event-driven task automation framework capable of dynamic tool calling, step-by-step verification, and external API execution.',
      role: 'Sole Developer',
      technologies: ['TypeScript', 'Node.js', 'Zod', 'SSE Streaming'],
      outcomesOrImpact: [
        'Engineered resilient tool execution pipeline with schema-validated parameter parsing.',
        'Handled parallel execution of multiple sub-agent tasks with zero race conditions.',
      ],
      githubUrl: 'https://github.com/farhan/agent-orchestrator',
      liveUrl: '',
      featured: true,
    },
  ],
  documents: [
    {
      id: 'doc-1',
      title: 'Farhan Professional CV (Summary Edition)',
      type: 'cv',
      content: `# Farhan — Senior Software Engineer & AI Systems Developer
- Email: farhan@example.com | Location: Dhaka, Bangladesh | Remote
- Summary: 5+ years of engineering experience spanning TypeScript, Next.js, Node.js, and Agentic AI systems.
- Core philosophy: Build clean, deterministic, well-typed architectures that solve tangible problems.`,
      addedAt: new Date().toISOString(),
    },
  ],
  updatedAt: new Date().toISOString(),
};
