import { ToolDefinition } from '@/types/tools';

export const CAREER_TOOLS: ToolDefinition[] = [
  {
    name: 'discover_opportunities',
    description: 'Find, rank, and match high-quality tech career opportunities suited to Farhan\'s verified skills, target roles, and remote work preferences.',
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Optional keyword or focus area (e.g., "AI Engineer", "Next.js", "Staff Engineer")',
        },
        role: {
          type: 'string',
          description: 'Target role title filter',
        },
        workModel: {
          type: 'string',
          description: 'Preferred work model',
          enum: ['remote', 'hybrid', 'on-site'],
        },
      },
    },
  },
  {
    name: 'analyze_job_description',
    description: 'Deconstruct a raw job description to extract required technical skills, seniority level, primary responsibilities, and company expectations.',
    parameters: {
      type: 'object',
      properties: {
        jobDescriptionText: {
          type: 'string',
          description: 'The complete text of the job description or posting',
        },
        companyName: {
          type: 'string',
          description: 'The name of the hiring company or client',
        },
        jobTitle: {
          type: 'string',
          description: 'The job title (e.g. Senior AI Engineer)',
        },
      },
      required: ['jobDescriptionText'],
    },
  },
  {
    name: 'analyze_skill_gap',
    description: 'Evaluate the alignment between Farhan\'s verified profile and a target role or job description. Computes exact match score, verified strengths, missing competencies, and a tactical learning roadmap.',
    parameters: {
      type: 'object',
      properties: {
        targetRole: {
          type: 'string',
          description: 'Target job title (e.g. "AI Systems Architect" or "Senior Full-Stack Engineer")',
        },
        requiredSkills: {
          type: 'string',
          description: 'Comma-separated list of required skills or technologies',
        },
        jobDescriptionText: {
          type: 'string',
          description: 'Optional raw job description text for deep comparison',
        },
      },
      required: ['targetRole'],
    },
  },
  {
    name: 'generate_proposal',
    description: 'Draft a personalized, high-converting proposal or cover letter tailored to a specific opportunity. Strictly utilizes Farhan\'s verified achievements and metrics. Requires human review before sending.',
    parameters: {
      type: 'object',
      properties: {
        companyName: {
          type: 'string',
          description: 'Name of the hiring company or client',
        },
        roleTitle: {
          type: 'string',
          description: 'Title of the role or project',
        },
        keyRequirements: {
          type: 'string',
          description: 'Summary of key requirements or pain points to address',
        },
      },
      required: ['companyName', 'roleTitle'],
    },
    requiresHumanApproval: true,
  },
  {
    name: 'customize_resume',
    description: 'Generate tailored resume bullet points and summary framing for a specific target job without inventing any facts or unverified metrics.',
    parameters: {
      type: 'object',
      properties: {
        targetRole: {
          type: 'string',
          description: 'The role Farhan is tailoring his CV for',
        },
        targetCompany: {
          type: 'string',
          description: 'Target company or industry',
        },
      },
      required: ['targetRole'],
    },
  },
  {
    name: 'start_mock_interview',
    description: 'Initialize a simulated technical or behavioral mock interview session tailored to Farhan\'s target roles.',
    parameters: {
      type: 'object',
      properties: {
        category: {
          type: 'string',
          description: 'Category of interview question',
          enum: ['technical_architecture', 'ai_systems', 'behavioral_star'],
        },
        difficulty: {
          type: 'string',
          description: 'Question difficulty level',
          enum: ['senior', 'staff', 'lead'],
        },
      },
      required: ['category'],
    },
  },
  {
    name: 'evaluate_interview_answer',
    description: 'Evaluate a candidate\'s mock interview answer using the STAR rubric and technical depth scoring.',
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: 'The interview question asked',
        },
        userAnswer: {
          type: 'string',
          description: 'The user\'s answer to evaluate',
        },
      },
      required: ['question', 'userAnswer'],
    },
  },
];
