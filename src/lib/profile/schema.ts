import { z } from 'zod';

export const SkillItemSchema = z.object({
  name: z.string().min(1),
  proficiency: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
  yearsOfExperience: z.number().optional(),
  highlight: z.boolean().optional(),
});

export const SkillCategorySchema = z.object({
  category: z.string().min(1),
  skills: z.array(SkillItemSchema),
});

export const ExperienceItemSchema = z.object({
  id: z.string().min(1),
  role: z.string().min(1),
  company: z.string().min(1),
  location: z.string().optional(),
  employmentType: z.enum(['full-time', 'part-time', 'contract', 'freelance', 'internship']),
  startDate: z.string().min(4),
  endDate: z.string().optional(),
  current: z.boolean().default(false),
  summary: z.string().min(1),
  achievements: z.array(z.string()),
  technologiesUsed: z.array(z.string()),
});

export const EducationItemSchema = z.object({
  id: z.string().min(1),
  institution: z.string().min(1),
  degree: z.string().min(1),
  fieldOfStudy: z.string().min(1),
  startDate: z.string().min(4),
  endDate: z.string().min(4),
  gradeOrGpa: z.string().optional(),
  highlights: z.array(z.string()).optional(),
});

export const ProjectItemSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1),
  role: z.string().min(1),
  technologies: z.array(z.string()),
  outcomesOrImpact: z.array(z.string()),
  githubUrl: z.string().url().optional().or(z.literal('')),
  liveUrl: z.string().url().optional().or(z.literal('')),
  featured: z.boolean().default(false),
});

export const CareerPreferencesSchema = z.object({
  targetRoles: z.array(z.string()),
  preferredIndustries: z.array(z.string()),
  workModel: z.enum(['remote', 'hybrid', 'on-site', 'flexible']),
  preferredLocations: z.array(z.string()),
  noticePeriodDays: z.number().optional(),
  shortTermGoals: z.array(z.string()),
  longTermGoals: z.array(z.string()),
  coreValues: z.array(z.string()),
});

export const PersonalInfoSchema = z.object({
  fullName: z.string().min(1),
  preferredName: z.string().min(1),
  headline: z.string().min(1),
  bio: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  location: z.string().min(1),
  links: z.object({
    github: z.string().url().optional().or(z.literal('')),
    linkedin: z.string().url().optional().or(z.literal('')),
    portfolio: z.string().url().optional().or(z.literal('')),
    twitter: z.string().url().optional().or(z.literal('')),
  }),
});

export const IngestedDocumentSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  type: z.enum(['cv', 'cover_letter', 'project_spec', 'note', 'certification']),
  content: z.string().min(1),
  addedAt: z.string(),
});

export const UserProfileSchema = z.object({
  personalInfo: PersonalInfoSchema,
  careerPreferences: CareerPreferencesSchema,
  skills: z.array(SkillCategorySchema),
  experience: z.array(ExperienceItemSchema),
  education: z.array(EducationItemSchema),
  projects: z.array(ProjectItemSchema),
  documents: z.array(IngestedDocumentSchema),
  updatedAt: z.string(),
});
