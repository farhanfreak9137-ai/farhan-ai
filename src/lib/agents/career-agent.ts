import { z } from 'zod';
import { Agent, AgentTool } from './types';
import { getProfile, getDocumentsFromDb } from '../profile/store';
import {
  executeAnalyzeSkillGap,
  executeAnalyzeJobDescription,
  executeStartMockInterview,
  executeEvaluateInterviewAnswer,
  executeGenerateProposal,
} from '../tools/registry';
import {
  getApplications,
  addApplicationAsync,
  updateApplicationStatusAsync,
} from '../tracker/store';

export const CareerAgent: Agent = {
  id: 'career_agent',
  name: 'Career Agent',
  description: "Owns Farhan's verified profile, skills analysis, document ingestion, job tracker, and interview simulation.",
  capabilities: [
    'candidate_profile_inspection',
    'document_retrieval',
    'skill_gap_analysis',
    'job_description_analysis',
    'interview_simulation',
    'interview_evaluation',
    'application_tracking',
    'proposal_generation',
  ],
  tools: [
    {
      name: 'get_profile',
      description: "Retrieve Farhan's verified candidate profile, including headline, verified skills, work experience, education, projects, and career preferences.",
      agentId: 'career_agent',
      inputSchema: z.object({}),
      execute: async () => {
        const profile = getProfile();
        return {
          toolName: 'get_profile',
          success: true,
          data: profile,
        };
      },
    },
    {
      name: 'get_documents',
      description: "Retrieve Farhan's ingested CV documents, case studies, and technical notes from persistent storage.",
      agentId: 'career_agent',
      inputSchema: z.object({}),
      execute: async () => {
        const docs = await getDocumentsFromDb();
        return {
          toolName: 'get_documents',
          success: true,
          data: docs,
        };
      },
    },
    {
      name: 'analyze_skill_gap',
      description: "Evaluate alignment between Farhan's verified profile and a target role or job description. Computes match score, verified strengths, gaps, and a tactical learning roadmap.",
      agentId: 'career_agent',
      inputSchema: z.object({
        targetRole: z.string().describe('Target job title (e.g. "AI Systems Architect" or "Senior Full-Stack Engineer")'),
        requiredSkills: z.string().optional().describe('Comma-separated list of required skills or technologies'),
        jobDescriptionText: z.string().optional().describe('Optional raw job description text for deep comparison'),
      }),
      execute: async (input) => {
        return executeAnalyzeSkillGap(input);
      },
    },
    {
      name: 'analyze_job_description',
      description: 'Deconstruct a raw job description to extract required technical skills, seniority level, primary responsibilities, and company expectations.',
      agentId: 'career_agent',
      inputSchema: z.object({
        jobDescriptionText: z.string().min(1).describe('The complete text of the job description or posting'),
        companyName: z.string().optional().describe('The name of the hiring company or client'),
        jobTitle: z.string().optional().describe('The job title'),
      }),
      execute: async (input) => {
        return executeAnalyzeJobDescription(input);
      },
    },
    {
      name: 'start_mock_interview',
      description: 'Initialize a simulated technical or behavioral mock interview session tailored to Farhan\'s target roles.',
      agentId: 'career_agent',
      inputSchema: z.object({
        category: z.enum(['technical_architecture', 'ai_systems', 'behavioral_star']).describe('Category of interview question'),
        difficulty: z.enum(['senior', 'staff', 'lead']).optional().default('senior').describe('Question difficulty level'),
      }),
      execute: async (input) => {
        return executeStartMockInterview(input);
      },
    },
    {
      name: 'evaluate_interview_answer',
      description: 'Evaluate a mock interview answer using the STAR rubric and technical depth scoring. Persists evaluation result to database.',
      agentId: 'career_agent',
      inputSchema: z.object({
        question: z.string().min(1).describe('The interview question asked'),
        userAnswer: z.string().min(1).describe("The candidate's answer to evaluate"),
      }),
      execute: async (input) => {
        return executeEvaluateInterviewAnswer(input);
      },
    },
    {
      name: 'get_applications',
      description: 'Retrieve all tracked job applications and their current pipeline statuses (saved, applied, interviewing, offer, rejected).',
      agentId: 'career_agent',
      inputSchema: z.object({}),
      execute: async () => {
        const apps = getApplications();
        return {
          toolName: 'get_applications',
          success: true,
          data: apps,
        };
      },
    },
    {
      name: 'create_application',
      description: 'Create a new job application record in the application tracker. MUTATING ACTION — requires human authorization.',
      agentId: 'career_agent',
      isMutation: true,
      requiresHumanApproval: true,
      inputSchema: z.object({
        company: z.string().min(1).describe('Company name'),
        role: z.string().min(1).describe('Role title'),
        location: z.string().default('Remote').describe('Job location'),
        workModel: z.enum(['remote', 'hybrid', 'on-site']).default('remote').describe('Work model'),
        status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected']).default('saved').describe('Initial status'),
        matchScore: z.number().default(85).describe('Match score percentage'),
        salaryRange: z.string().optional().describe('Salary range'),
        notes: z.string().optional().describe('Application notes'),
      }),
      buildApprovalPayload: (input) => ({
        actionType: 'create_application',
        title: `Track Application: ${input.role} at ${input.company}`,
        description: `Add a new record to Farhan's job tracker pipeline for ${input.role} at ${input.company}.`,
        payload: input,
      }),
      execute: async (input) => {
        const created = await addApplicationAsync(input);
        return {
          toolName: 'create_application',
          success: true,
          data: created,
        };
      },
    },
    {
      name: 'update_application_status',
      description: 'Update the pipeline status of an existing job application. MUTATING ACTION — requires human authorization.',
      agentId: 'career_agent',
      isMutation: true,
      requiresHumanApproval: true,
      inputSchema: z.object({
        id: z.string().min(1).describe('Application ID'),
        status: z.enum(['saved', 'applied', 'interviewing', 'offer', 'rejected']).describe('New application status'),
      }),
      buildApprovalPayload: (input) => ({
        actionType: 'update_application',
        title: `Update Application Status to '${input.status}'`,
        description: `Authorize changing application ${input.id} status to '${input.status}'.`,
        payload: input,
      }),
      execute: async (input) => {
        const updated = await updateApplicationStatusAsync(input.id, input.status);
        if (!updated) {
          return {
            toolName: 'update_application_status',
            success: false,
            error: `Application with ID '${input.id}' not found.`,
          };
        }
        return {
          toolName: 'update_application_status',
          success: true,
          data: updated,
        };
      },
    },
    {
      name: 'generate_proposal',
      description: "Draft a personalized proposal or cover letter tailored to a specific opportunity using Farhan's verified achievements. EXPORT ACTION — requires human review.",
      agentId: 'career_agent',
      requiresHumanApproval: true,
      inputSchema: z.object({
        companyName: z.string().optional().describe('Name of the hiring company'),
        company: z.string().optional().describe('Name of the hiring company'),
        roleTitle: z.string().optional().describe('Target role title'),
        role: z.string().optional().describe('Target role title'),
        keyRequirements: z.string().optional().describe('Key technical requirements or pain points'),
      }),
      buildApprovalPayload: (input) => {
        const company = input.companyName || input.company || 'Unknown';
        const role = input.roleTitle || input.role || 'Target Role';
        return {
          actionType: 'export_proposal',
          title: `Personalized Proposal for ${company}`,
          description: `Drafted custom proposal for ${role} using Farhan's verified background. Human review required before sending or exporting.`,
          payload: { ...input, company, role },
        };
      },
      execute: async (input) => {
        return executeGenerateProposal({
          companyName: input.companyName || input.company || '',
          roleTitle: input.roleTitle || input.role || '',
          keyRequirements: input.keyRequirements,
        });
      },
    },
  ],
};

export const careerAgent = CareerAgent;
