export type ApplicationStatus = 'saved' | 'applied' | 'interviewing' | 'offer' | 'rejected';

export interface ApplicationItem {
  id: string;
  company: string;
  role: string;
  location: string;
  workModel: 'remote' | 'hybrid' | 'on-site';
  status: ApplicationStatus;
  matchScore: number;
  salaryRange?: string;
  notes?: string;
  proposalDraft?: string;
  appliedDate?: string;
  updatedAt: string;
}
