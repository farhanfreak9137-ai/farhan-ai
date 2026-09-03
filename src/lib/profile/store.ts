import { UserProfile } from '@/types/profile';
import { defaultProfile } from '@/data/defaultProfile';
import { UserProfileSchema } from './schema';
import { db, ensureDatabaseReady } from '@/lib/db';
import { profiles, documents } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';

// In-memory cache synced with SQLite
let currentProfile: UserProfile = { ...defaultProfile };
let isProfileLoaded = false;
let loadPromise: Promise<void> | null = null;

/**
 * Ensures profile is rehydrated from SQLite into memory without race conditions.
 */
export async function ensureProfileLoaded(): Promise<void> {
  if (isProfileLoaded) return;
  if (!loadPromise) {
    loadPromise = (async () => {
      try {
        await ensureDatabaseReady();
        const rows = await db.select().from(profiles).where(eq(profiles.id, 'main')).limit(1);
        if (rows.length > 0 && rows[0].data) {
          const raw = rows[0].data;
          const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
          const result = UserProfileSchema.safeParse(parsed);
          if (result.success) {
            currentProfile = result.data;
          }
        }
      } catch (err) {
        console.error('Error rehydrating profile from SQLite:', err);
      } finally {
        isProfileLoaded = true;
      }
    })();
  }
  return loadPromise;
}

/**
 * Synchronous profile accessor (reads from live memory cache).
 */
export function getProfile(): UserProfile {
  const result = UserProfileSchema.safeParse(currentProfile);
  if (!result.success) {
    console.error('Profile schema validation error:', result.error.format());
    return defaultProfile;
  }
  return result.data;
}

export function getProfileSync(): UserProfile {
  return getProfile();
}

export async function getProfileAsync(): Promise<UserProfile> {
  await ensureProfileLoaded();
  return getProfile();
}

/**
 * Updates the user profile with schema validation and persists to SQLite.
 */
export function updateProfile(updated: Partial<UserProfile>): UserProfile {
  const merged: UserProfile = {
    ...currentProfile,
    ...updated,
    updatedAt: new Date().toISOString(),
  };

  const parsed = UserProfileSchema.parse(merged);
  currentProfile = parsed;

  ensureDatabaseReady()
    .then(async () => {
      await db
        .insert(profiles)
        .values({
          id: 'main',
          data: parsed as any,
          updatedAt: parsed.updatedAt,
        })
        .onConflictDoUpdate({
          target: profiles.id,
          set: {
            data: parsed as any,
            updatedAt: parsed.updatedAt,
          },
        });
    })
    .catch((err) => {
      console.error('Failed to persist profile update to SQLite:', err);
    });

  return currentProfile;
}

export async function updateProfileAsync(updated: Partial<UserProfile>): Promise<UserProfile> {
  await ensureProfileLoaded();
  const merged: UserProfile = {
    ...currentProfile,
    ...updated,
    updatedAt: new Date().toISOString(),
  };

  const parsed = UserProfileSchema.parse(merged);
  currentProfile = parsed;

  await db
    .insert(profiles)
    .values({
      id: 'main',
      data: parsed as any,
      updatedAt: parsed.updatedAt,
    })
    .onConflictDoUpdate({
      target: profiles.id,
      set: {
        data: parsed as any,
        updatedAt: parsed.updatedAt,
      },
    });

  return currentProfile;
}

/**
 * Appends an ingested document (CV, case study, notes) to Farhan's profile and persists to SQLite.
 */
export function addDocument(document: {
  title: string;
  type: 'cv' | 'cover_letter' | 'project_spec' | 'note' | 'certification';
  content: string;
}): UserProfile {
  const newDoc = {
    id: `doc-${Date.now()}`,
    title: document.title.trim(),
    type: document.type,
    content: document.content.trim(),
    addedAt: new Date().toISOString(),
  };

  ensureDatabaseReady()
    .then(async () => {
      await db.insert(documents).values({
        id: newDoc.id,
        title: newDoc.title,
        type: newDoc.type,
        content: newDoc.content,
        addedAt: newDoc.addedAt,
      });
    })
    .catch((err) => {
      console.error('Failed to persist document to SQLite:', err);
    });

  const updatedDocs = [newDoc, ...(currentProfile.documents || [])];
  return updateProfile({ documents: updatedDocs });
}

export async function addDocumentAsync(document: {
  title: string;
  type: 'cv' | 'cover_letter' | 'project_spec' | 'note' | 'certification';
  content: string;
}): Promise<UserProfile> {
  await ensureProfileLoaded();
  const newDoc = {
    id: `doc-${Date.now()}`,
    title: document.title.trim(),
    type: document.type,
    content: document.content.trim(),
    addedAt: new Date().toISOString(),
  };

  await db.insert(documents).values({
    id: newDoc.id,
    title: newDoc.title,
    type: newDoc.type,
    content: newDoc.content,
    addedAt: newDoc.addedAt,
  });

  const updatedDocs = [newDoc, ...(currentProfile.documents || [])];
  return updateProfileAsync({ documents: updatedDocs });
}

/**
 * Fetches all ingested documents directly from SQLite.
 */
export async function getDocumentsFromDb() {
  await ensureDatabaseReady();
  return db.select().from(documents).orderBy(desc(documents.addedAt));
}

/**
 * Serializes the structured profile into a clean, markdown-grounded context block
 * specifically tailored for LLM injection with strict factual anchoring.
 */
export function formatProfileForContext(profile: UserProfile): string {
  const { personalInfo, careerPreferences, skills, experience, education, projects, documents } = profile;

  let out = `## CANDIDATE PROFILE: ${personalInfo.fullName.toUpperCase()} (${personalInfo.headline})\n`;
  out += `- Preferred Name: ${personalInfo.preferredName}\n`;
  out += `- Location: ${personalInfo.location}\n`;
  out += `- Bio: ${personalInfo.bio}\n`;
  if (personalInfo.links.github) out += `- GitHub: ${personalInfo.links.github}\n`;
  if (personalInfo.links.linkedin) out += `- LinkedIn: ${personalInfo.links.linkedin}\n`;
  if (personalInfo.links.portfolio) out += `- Portfolio: ${personalInfo.links.portfolio}\n`;

  out += `\n### CAREER PREFERENCES & GOALS\n`;
  out += `- Target Roles: ${careerPreferences.targetRoles.join(', ')}\n`;
  out += `- Work Model: ${careerPreferences.workModel}\n`;
  out += `- Preferred Locations: ${careerPreferences.preferredLocations.join(', ')}\n`;
  out += `- Target Industries: ${careerPreferences.preferredIndustries.join(', ')}\n`;
  out += `- Short-Term Goals (6-12 mo): ${careerPreferences.shortTermGoals.join('; ')}\n`;
  out += `- Long-Term Goals (2-5 yr): ${careerPreferences.longTermGoals.join('; ')}\n`;
  out += `- Core Values: ${careerPreferences.coreValues.join('; ')}\n`;

  out += `\n### SKILLS & COMPETENCIES (VERIFIED)\n`;
  skills.forEach((cat) => {
    const skillList = cat.skills
      .map((s) => `${s.name} (${s.proficiency}${s.yearsOfExperience ? `, ${s.yearsOfExperience}y` : ''})`)
      .join(', ');
    out += `- **${cat.category}**: ${skillList}\n`;
  });

  out += `\n### WORK EXPERIENCE (VERIFIED)\n`;
  experience.forEach((exp) => {
    out += `#### ${exp.role} at ${exp.company} (${exp.startDate} - ${exp.current ? 'Present' : exp.endDate || 'N/A'})\n`;
    out += `Summary: ${exp.summary}\n`;
    out += `Key Achievements:\n`;
    exp.achievements.forEach((a) => {
      out += `  * ${a}\n`;
    });
    out += `Technologies Used: ${exp.technologiesUsed.join(', ')}\n\n`;
  });

  out += `### EDUCATION & CREDENTIALS\n`;
  education.forEach((edu) => {
    out += `- **${edu.degree} in ${edu.fieldOfStudy}**, ${edu.institution} (${edu.startDate} - ${edu.endDate})`;
    if (edu.gradeOrGpa) out += ` [GPA: ${edu.gradeOrGpa}]`;
    out += `\n`;
    if (edu.highlights && edu.highlights.length > 0) {
      edu.highlights.forEach((h) => {
        out += `  * ${h}\n`;
      });
    }
  });

  out += `\n### FEATURED PROJECTS\n`;
  projects.forEach((p) => {
    out += `#### ${p.title} (${p.role})\n`;
    out += `Description: ${p.description}\n`;
    out += `Tech Stack: ${p.technologies.join(', ')}\n`;
    out += `Impact / Key Highlights:\n`;
    p.outcomesOrImpact.forEach((impact) => {
      out += `  * ${impact}\n`;
    });
    if (p.githubUrl) out += `Code: ${p.githubUrl}\n`;
    if (p.liveUrl) out += `Demo: ${p.liveUrl}\n`;
    out += `\n`;
  });

  if (documents && documents.length > 0) {
    out += `### INGESTED DOCUMENTS & CV ATTACHMENTS\n`;
    documents.forEach((doc) => {
      out += `--- Document: ${doc.title} (${doc.type.toUpperCase()}) ---\n`;
      out += `${doc.content}\n\n`;
    });
  }

  return out;
}
