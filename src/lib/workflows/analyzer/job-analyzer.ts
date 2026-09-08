import { NormalizedOpportunity } from '@/lib/opportunities/types';

export interface AnalyzedJobDescription {
  title: string;
  company: string;
  level?: string | null;
  workModel?: string | null;
  location?: string | null;
  minYearsExperience?: number | null;
  salaryRange?: string | null;
  visaSupport?: string | null;
  requiredSkills: string[];
  preferredSkills: string[];
  technologies: string[];
  responsibilities: string[];
  experienceRequirements: string | null;
  educationRequirements: string | null;
  locationRequirements: string | null;
  employmentType: string | null;
  compensation: string | null;
  applicationMethod: string | null;
  constraints: string[];
  rawTextLength: number;
}

export class JobDescriptionAnalyzer {
  private static TECH_DICTIONARY = [
    'TypeScript',
    'JavaScript',
    'Python',
    'Go',
    'Rust',
    'Java',
    'C++',
    'React',
    'Next.js',
    'Vue',
    'Node.js',
    'PostgreSQL',
    'MySQL',
    'Redis',
    'Elasticsearch',
    'Docker',
    'Kubernetes',
    'AWS',
    'GCP',
    'Azure',
    'GraphQL',
    'REST',
    'RAG',
    'LLM',
    'LangChain',
    'LlamaIndex',
    'PyTorch',
    'TensorFlow',
    'Tailwind',
    'HTML5',
    'CSS',
    'Linux',
    'Git',
    'CI/CD',
    'Drizzle',
    'Prisma',
  ];

  /**
   * Analyzes an opportunity or raw text into structured factual requirements without inventing details.
   */
  public static analyze(
    input: NormalizedOpportunity | { text: string; company?: string; title?: string } | string,
    companyParam?: string,
    titleParam?: string
  ): AnalyzedJobDescription {
    let rawText = '';
    let title = titleParam || 'Software Engineer';
    let company = companyParam || 'Target Company';
    let location = 'Remote';
    let salaryRange: string | null = null;
    let initialSkills: string[] = [];

    if (typeof input === 'string') {
      rawText = input;
      title = titleParam || this.extractTitle(rawText) || 'Software Engineer';
      company = companyParam || this.extractCompany(rawText) || 'Target Company';
    } else if ('description' in input) {
      // NormalizedOpportunity
      rawText = `${input.title}\n${input.company}\n${input.description}`;
      title = input.title;
      company = input.company;
      location = input.location;
      salaryRange = input.salaryRange || null;
      initialSkills = input.requiredSkills || [];
    } else {
      rawText = input.text;
      title = input.title || titleParam || this.extractTitle(rawText) || 'Software Engineer';
      company = input.company || companyParam || this.extractCompany(rawText) || 'Target Company';
    }

    const technologies = this.extractTechnologies(rawText);
    const combinedRequired = Array.from(new Set([...initialSkills, ...technologies]));

    const preferredSkills = this.extractPreferredSkills(rawText);
    const responsibilities = this.extractResponsibilities(rawText);
    const experienceRequirements = this.extractExperience(rawText);
    const educationRequirements = this.extractEducation(rawText);
    const locationRequirements = location || this.extractLocation(rawText);
    const employmentType = this.extractEmploymentType(rawText);
    const compensation = salaryRange || this.extractCompensation(rawText);
    const applicationMethod = this.extractApplicationMethod(rawText);
    const constraints = this.extractConstraints(rawText);

    // Seniority level
    let level: string | null = null;
    if (/\b(?:senior|sr\.?|lead|principal|staff)\b/i.test(title) || /\b(?:senior|sr\.?|lead|principal|staff)\b/i.test(rawText)) {
      level = 'senior';
    } else if (/\b(?:junior|jr\.?|associate|entry)\b/i.test(title) || /\b(?:junior|jr\.?|associate|entry)\b/i.test(rawText)) {
      level = 'junior';
    } else if (/\b(?:mid|intermediate)\b/i.test(title)) {
      level = 'mid';
    }

    // Work model
    let workModel: string | null = null;
    if (/\bremote\b/i.test(rawText) || /\bremote\b/i.test(locationRequirements || '')) {
      workModel = 'remote';
    } else if (/\bhybrid\b/i.test(rawText) || /\bhybrid\b/i.test(locationRequirements || '')) {
      workModel = 'hybrid';
    } else if (/\b(?:on-site|onsite|in-office)\b/i.test(rawText)) {
      workModel = 'onsite';
    }

    // Minimum years of experience
    let minYearsExperience: number | null = null;
    const yearsMatch = rawText.match(/(\d+)\+?\s*(?:years|yrs)/i);
    if (yearsMatch) {
      minYearsExperience = parseInt(yearsMatch[1], 10);
    }

    // Visa support
    let visaSupport: string | null = null;
    if (/(?:visa\s*sponsorship|h-1b|h1b|visa\s*support)/i.test(rawText)) {
      visaSupport = /no\s*(?:visa|h-1b)|cannot\s*sponsor/i.test(rawText) ? 'No' : 'Yes';
    }

    return {
      title,
      company,
      level,
      workModel,
      location: locationRequirements,
      minYearsExperience,
      salaryRange: compensation,
      visaSupport,
      requiredSkills: combinedRequired.length > 0 ? combinedRequired : ['Software Engineering'],
      preferredSkills,
      technologies,
      responsibilities: responsibilities.length > 0 ? responsibilities : ['Architecture, development, and engineering standard execution.'],
      experienceRequirements,
      educationRequirements,
      locationRequirements,
      employmentType,
      compensation,
      applicationMethod,
      constraints,
      rawTextLength: rawText.length,
    };
  }

  private static extractTechnologies(text: string): string[] {
    const found: string[] = [];
    for (const tech of this.TECH_DICTIONARY) {
      const regex = new RegExp(`\\b${tech.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      if (regex.test(text)) {
        found.push(tech);
      }
    }
    return found;
  }

  private static extractPreferredSkills(text: string): string[] {
    const preferredSectionRegex = /(?:nice to have|preferred|bonus points|plus|good to have):?([\s\S]*?)(?=(?:requirements|qualifications|responsibilities|benefits|about|$))/i;
    const match = text.match(preferredSectionRegex);
    if (!match) return [];

    const section = match[1];
    return this.extractTechnologies(section);
  }

  private static extractResponsibilities(text: string): string[] {
    const lines = text.split('\n');
    const responsibilities: string[] = [];
    let inResp = false;

    for (const line of lines) {
      const trimmed = line.trim();
      if (/responsibilities|what you will do|what you'll do|the role|your impact/i.test(trimmed)) {
        inResp = true;
        continue;
      }
      if (inResp && /requirements|qualifications|about you|benefits/i.test(trimmed)) {
        inResp = false;
        break;
      }
      if (inResp && (trimmed.startsWith('•') || trimmed.startsWith('-') || trimmed.startsWith('*'))) {
        responsibilities.push(trimmed.replace(/^[•\-\*]\s*/, '').trim());
      }
    }

    return responsibilities.slice(0, 8);
  }

  private static extractExperience(text: string): string | null {
    const expRegex = /(\d+\+?\s*(?:-\s*\d+)?\s*(?:years|yrs)\s+(?:of\s+)?(?:experience|exp))/i;
    const match = text.match(expRegex);
    return match ? match[1] : null;
  }

  private static extractEducation(text: string): string | null {
    if (/ph\.?d|doctorate/i.test(text)) return 'Ph.D. in Computer Science or related STEM field';
    if (/master'?s|m\.?s\.?/i.test(text)) return "Master's in Computer Science or equivalent STEM degree";
    if (/bachelor'?s|b\.?s\.?|degree in computer science/i.test(text)) return "Bachelor's degree in Computer Science or equivalent practical experience";
    return null;
  }

  private static extractLocation(text: string): string | null {
    if (/remote\s*\(worldwide\)|anywhere/i.test(text)) return 'Remote (Worldwide)';
    if (/remote\s*\(us\)/i.test(text)) return 'Remote (US Only)';
    if (/remote/i.test(text)) return 'Remote';
    if (/hybrid/i.test(text)) return 'Hybrid';
    if (/on-site|onsite/i.test(text)) return 'On-site';
    return null;
  }

  private static extractEmploymentType(text: string): string | null {
    if (/full-time|full time/i.test(text)) return 'Full-time';
    if (/part-time|part time/i.test(text)) return 'Part-time';
    if (/contract|contractor|freelance/i.test(text)) return 'Contract';
    return null;
  }

  private static extractCompensation(text: string): string | null {
    const salaryRegex = /(\$\s*\d+[\d,kK]*\s*(?:-\s*\$?\s*\d+[\d,kK]*)?(?:\s*(?:usd|per year|\/yr|\/year))?)/i;
    const match = text.match(salaryRegex);
    return match ? match[1].trim() : null;
  }

  private static extractApplicationMethod(text: string): string | null {
    const urlMatch = text.match(/https?:\/\/[^\s)]+/);
    return urlMatch ? urlMatch[0] : null;
  }

  private static extractConstraints(text: string): string[] {
    const constraints: string[] = [];
    if (/security clearance/i.test(text)) constraints.push('Requires security clearance');
    if (/us citizen|us work authorization/i.test(text)) constraints.push('Requires US work authorization');
    if (/timezone overlap|utc|est|pst/i.test(text)) constraints.push('Requires timezone overlap');
    return constraints;
  }

  private static extractTitle(text: string): string | null {
    const firstLine = text.split('\n')[0]?.trim();
    if (firstLine && firstLine.length < 80 && !firstLine.includes('.')) {
      return firstLine;
    }
    return null;
  }

  private static extractCompany(text: string): string | null {
    const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
    if (lines.length > 1 && lines[1].length < 60 && !lines[1].includes('.')) {
      return lines[1];
    }
    return null;
  }
}
