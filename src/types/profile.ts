export type SkillProficiency = 'beginner' | 'intermediate' | 'advanced' | 'expert';

export interface SkillCategory {
  category: string; // e.g. "Languages & Core", "AI & ML", "Frameworks", "Databases & Cloud", "Tools & DevOps"
  skills: {
    name: string;
    proficiency: SkillProficiency;
    yearsOfExperience?: number;
    highlight?: boolean;
  }[];
}

export interface ExperienceItem {
  id: string;
  role: string;
  company: string;
  location?: string;
  employmentType: 'full-time' | 'part-time' | 'contract' | 'freelance' | 'internship';
  startDate: string; // YYYY-MM
  endDate?: string; // YYYY-MM or undefined if current
  current: boolean;
  summary: string;
  achievements: string[];
  technologiesUsed: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  fieldOfStudy: string;
  startDate: string; // YYYY
  endDate: string; // YYYY or expected
  gradeOrGpa?: string;
  highlights?: string[];
}

export interface ProjectItem {
  id: string;
  title: string;
  description: string;
  role: string;
  technologies: string[];
  outcomesOrImpact: string[];
  githubUrl?: string;
  liveUrl?: string;
  featured: boolean;
}

export interface CareerPreferences {
  targetRoles: string[];
  preferredIndustries: string[];
  workModel: 'remote' | 'hybrid' | 'on-site' | 'flexible';
  preferredLocations: string[];
  noticePeriodDays?: number;
  shortTermGoals: string[]; // 6-12 months
  longTermGoals: string[]; // 2-5 years
  coreValues: string[]; // e.g., "Autonomy", "Continuous Learning", "High Impact"
}

export interface PersonalInfo {
  fullName: string;
  preferredName: string;
  headline: string;
  bio: string;
  email?: string;
  location: string;
  links: {
    github?: string;
    linkedin?: string;
    portfolio?: string;
    twitter?: string;
  };
}

export interface IngestedDocument {
  id: string;
  title: string;
  type: 'cv' | 'cover_letter' | 'project_spec' | 'note' | 'certification';
  content: string;
  addedAt: string; // ISO date
}

export interface UserProfile {
  personalInfo: PersonalInfo;
  careerPreferences: CareerPreferences;
  skills: SkillCategory[];
  experience: ExperienceItem[];
  education: EducationItem[];
  projects: ProjectItem[];
  documents: IngestedDocument[];
  updatedAt: string;
}
