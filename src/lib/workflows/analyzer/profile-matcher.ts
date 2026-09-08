import { UserProfile } from '@/types/profile';
import { AnalyzedJobDescription } from './job-analyzer';

export interface RankingFactor {
  factor: string;
  score: number;
  weight: number;
  explanation: string;
}

export interface ProfileMatchResult {
  overallMatchScore: number;
  matchedSkills: string[];
  missingSkills: string[];
  preferredSkillsMatched: string[];
  preferredSkillsMissing: string[];
  relevantProjects: Array<{
    title: string;
    description: string;
    technologies: string[];
    alignmentReason: string;
  }>;
  experienceAlignment: Array<{
    role: string;
    company: string;
    relevance: string;
  }>;
  educationAlignment: string[];
  concerns: string[];
  reasoning: string[];
  factors: RankingFactor[];
  evidenceClassification: {
    verified: string[];
    inferred: string[];
    unknown: string[];
  };
}

export class ProfileMatcher {
  /**
   * Evaluates an analyzed job description against Farhan's verified profile.
   */
  public static match(jd: AnalyzedJobDescription, profile: UserProfile): ProfileMatchResult {
    // 1. Extract verified skills map from candidate records
    const verifiedSkillsMap = new Map<string, { proficiency: string; category: string }>();
    for (const cat of profile.skills) {
      for (const s of cat.skills) {
        verifiedSkillsMap.set(s.name.toLowerCase().trim(), {
          proficiency: s.proficiency,
          category: cat.category,
        });
      }
    }

    const verifiedSkillNames = Array.from(verifiedSkillsMap.keys());

    // 2. Evaluate Required Skills
    const matchedSkills: string[] = [];
    const missingSkills: string[] = [];

    for (const req of jd.requiredSkills) {
      const lowerReq = req.toLowerCase().trim();
      const isMatch = verifiedSkillNames.some(
        (v) => v === lowerReq || v.includes(lowerReq) || lowerReq.includes(v)
      );

      if (isMatch) {
        matchedSkills.push(req);
      } else {
        missingSkills.push(req);
      }
    }

    // 3. Evaluate Preferred Skills
    const preferredSkillsMatched: string[] = [];
    const preferredSkillsMissing: string[] = [];

    for (const pref of jd.preferredSkills) {
      const lowerPref = pref.toLowerCase().trim();
      const isMatch = verifiedSkillNames.some(
        (v) => v === lowerPref || v.includes(lowerPref) || lowerPref.includes(v)
      );

      if (isMatch) {
        preferredSkillsMatched.push(pref);
      } else {
        preferredSkillsMissing.push(pref);
      }
    }

    // 4. Align Relevant Verified Projects
    const relevantProjects: ProfileMatchResult['relevantProjects'] = [];
    const lowerRequired = jd.requiredSkills.map((s) => s.toLowerCase());

    for (const proj of profile.projects) {
      const projectTech = proj.technologies.map((t) => t.toLowerCase());
      const overlappingTech = projectTech.filter((t) =>
        lowerRequired.some((req) => req.includes(t) || t.includes(req))
      );

      if (overlappingTech.length > 0 || proj.title.toLowerCase().includes('agent') || proj.title.toLowerCase().includes('rag')) {
        relevantProjects.push({
          title: proj.title,
          description: proj.description,
          technologies: proj.technologies,
          alignmentReason: `Verified architecture using ${overlappingTech.join(', ') || 'production AI frameworks'}.`,
        });
      }
    }

    // 5. Align Work Experience
    const experienceAlignment: ProfileMatchResult['experienceAlignment'] = [];
    for (const exp of profile.experience) {
      const roleLower = exp.role.toLowerCase();
      const titleLower = jd.title.toLowerCase();
      let relevance = `Senior production background (${exp.startDate} - ${exp.endDate || 'Present'})`;
      if (
        (roleLower.includes('ai') && titleLower.includes('ai')) ||
        (roleLower.includes('engineer') && titleLower.includes('engineer'))
      ) {
        relevance = `Direct role symmetry: ${exp.role} at ${exp.company}`;
      }

      experienceAlignment.push({
        role: exp.role,
        company: exp.company,
        relevance,
      });
    }

    // 6. Education Alignment
    const educationAlignment: string[] = [];
    for (const edu of profile.education) {
      educationAlignment.push(`Verified: ${edu.degree} in ${edu.fieldOfStudy} from ${edu.institution} (${edu.endDate}).`);
    }

    // 7. Concerns & Unknowns
    const concerns: string[] = [];
    const unknownEvidence: string[] = [];

    if (jd.locationRequirements && !jd.locationRequirements.toLowerCase().includes('remote')) {
      concerns.push(`Job specifies location '${jd.locationRequirements}', whereas Farhan prefers remote roles.`);
    }

    if (missingSkills.length > 0) {
      concerns.push(`Unverified required competencies: ${missingSkills.slice(0, 4).join(', ')}.`);
    }

    if (!jd.compensation) {
      unknownEvidence.push('Compensation band not specified in job posting.');
    }

    if (!jd.experienceRequirements) {
      unknownEvidence.push('Exact years of experience not explicitly bounded in listing.');
    }

    // 8. Deterministic Factor Scoring & Ranking Breakdown
    const totalRequired = Math.max(jd.requiredSkills.length, 1);
    const skillScore = Math.min(100, Math.round((matchedSkills.length / totalRequired) * 100));

    const totalTech = Math.max(jd.technologies.length, 1);
    const matchedTechCount = jd.technologies.filter((t) =>
      verifiedSkillNames.some((v) => v.includes(t.toLowerCase()) || t.toLowerCase().includes(v))
    ).length;
    const techScore = Math.min(100, Math.round((matchedTechCount / totalTech) * 100));

    const targetRoles = profile.careerPreferences.targetRoles || [];
    const roleMatchesTarget = targetRoles.some((tr) =>
      jd.title.toLowerCase().includes(tr.toLowerCase()) || tr.toLowerCase().includes(jd.title.toLowerCase())
    );
    const expScore = roleMatchesTarget ? 95 : 80;

    const workModelScore =
      jd.locationRequirements && jd.locationRequirements.toLowerCase().includes('remote') ? 100 : 70;

    const projectScore = relevantProjects.length >= 2 ? 95 : relevantProjects.length === 1 ? 85 : 70;

    const factors: RankingFactor[] = [
      {
        factor: 'skill_match',
        score: skillScore,
        weight: 0.35,
        explanation: `Matched ${matchedSkills.length}/${totalRequired} listed requirements against verified profile.`,
      },
      {
        factor: 'technology_match',
        score: techScore,
        weight: 0.20,
        explanation: `Overlapping core engineering stack (${matchedTechCount}/${totalTech} detected technologies).`,
      },
      {
        factor: 'experience_compatibility',
        score: expScore,
        weight: 0.20,
        explanation: roleMatchesTarget
          ? `Direct alignment with target career roles (${targetRoles.join(', ')}).`
          : 'Compatible senior software engineering background.',
      },
      {
        factor: 'work_model_compatibility',
        score: workModelScore,
        weight: 0.15,
        explanation: workModelScore === 100
          ? 'Fully aligned with remote-first preferences.'
          : 'Non-remote or hybrid constraints detected.',
      },
      {
        factor: 'project_relevance',
        score: projectScore,
        weight: 0.10,
        explanation: `${relevantProjects.length} verified production projects demonstrated with matching architectural scope.`,
      },
    ];

    // Compute weighted aggregate
    let rawWeightedScore = factors.reduce((acc, f) => acc + f.score * f.weight, 0);

    // Minor penalty for missing critical requirements
    if (missingSkills.length > 2) {
      rawWeightedScore = Math.max(10, rawWeightedScore - (missingSkills.length - 2) * 3);
    }

    // Strict non-negotiable anti-hallucination cap: Never claim 100% guaranteed fit
    const finalScore = Math.min(Math.max(Math.round(rawWeightedScore), 15), 98);

    const reasoning: string[] = [
      `Overall match evaluated at ${finalScore}%.`,
      `Verified strengths: ${matchedSkills.slice(0, 5).join(', ') || 'General software practices'}.`,
      missingSkills.length > 0 ? `Unmatched requirements: ${missingSkills.slice(0, 4).join(', ')}.` : 'No critical skill gaps identified.',
      `Project alignment: ${relevantProjects.map((p) => p.title).join(', ') || 'Foundational web platforms'}.`,
    ];

    const verifiedEvidence = [
      ...matchedSkills.map((s) => `Skill: ${s}`),
      ...relevantProjects.map((p) => `Project: ${p.title}`),
      ...profile.experience.map((e) => `Experience: ${e.role} at ${e.company}`),
      ...profile.education.map((e) => `Education: ${e.degree} in ${e.fieldOfStudy}`),
    ];

    const inferredEvidence = [
      `Senior leadership readiness inferred from ${profile.experience.length} multi-year engineering roles.`,
      `Adaptability to ${missingSkills[0] || 'adjacent tools'} inferred from strong ${matchedSkills[0] || 'core language'} proficiency.`,
    ];

    const result: any = {
      overallMatchScore: finalScore,
      overallScore: finalScore,
      matchedSkills,
      missingSkills,
      skillGaps: missingSkills,
      preferredSkillsMatched,
      preferredSkillsMissing,
      relevantProjects,
      experienceAlignment,
      educationAlignment,
      concerns,
      reasoning,
      factors,
      breakdown: {
        skillsMatch: skillScore,
        experienceMatch: expScore,
        domainMatch: workModelScore,
        educationMatch: 85,
      },
      evidence: {
        verified: verifiedEvidence,
        inferred: inferredEvidence,
        unknown: unknownEvidence,
      },
      evidenceClassification: {
        verified: verifiedEvidence,
        inferred: inferredEvidence,
        unknown: unknownEvidence,
      },
    };

    return result;
  }

  /**
   * Alias helper accepting (profile, requirements) for test suites and conversational agents.
   */
  public static evaluateMatch(profile: UserProfile, requirements: any): any {
    const jd: AnalyzedJobDescription = {
      title: requirements.roleTitle || requirements.title || 'Software Engineer',
      company: requirements.companyName || requirements.company || 'Hiring Company',
      level: requirements.seniorityLevel || requirements.level || 'mid',
      workModel: requirements.workModel || 'remote',
      location: requirements.location || 'Remote',
      requiredSkills: requirements.requiredSkills || [],
      preferredSkills: requirements.preferredSkills || [],
      responsibilities: requirements.responsibilities || [],
      experienceRequirements: typeof requirements.experienceRequirements === 'string' ? requirements.experienceRequirements : null,
      educationRequirements: requirements.educationRequirements || null,
      locationRequirements: requirements.locationRequirements || requirements.location || null,
      employmentType: requirements.employmentType || null,
      compensation: requirements.compensation || requirements.salaryRange || null,
      applicationMethod: requirements.applicationMethod || null,
      minYearsExperience: requirements.minYearsExperience || null,
      salaryRange: requirements.salaryRange || null,
      constraints: requirements.constraints || [],
      visaSupport: requirements.visaSupport || null,
      technologies: requirements.technologies || requirements.requiredSkills || [],
      rawTextLength: 0,
    };
    return ProfileMatcher.match(jd, profile);
  }
}
