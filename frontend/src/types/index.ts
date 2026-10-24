/**
 * SkillBridge AI - Core Domain TypeScript Definitions
 * Aligned with Blueprint 2.0 (Sections 4, 7, 8, 11, 12)
 */

export type ProductMode = 'job_specific' | 'goal_based';
export type GoalType = 'job_opportunity' | 'career_role' | 'skill_goal';
export type SkillStatus = 'Demonstrated' | 'Self-reported' | 'Unverified' | 'Needs improvement';
export type PriorityLevel = 'High' | 'Medium' | 'Low';
export type ImportanceType = 'required' | 'preferred';
export type TaskType = 'assessment' | 'project' | 'study';

export type FeasibilityBand =
  | 'Likely feasible'
  | 'Tight / uncertain'
  | 'Not feasible as scoped'
  | 'Insufficient information';

// ── Auth types ──────────────────────────────────────────────────────────────

export interface SkillProfileSummary {
  profile_id: string;
  role_title: string;
  description: string;
}

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  full_name: string;
  date_joined: string;
}

export interface AuthTokens {
  access: string;
  refresh: string;
}

export interface AuthResponse extends AuthTokens {
  user: AuthUser;
}

export interface LoginPayload {
  username: string;
  password: string;
}

export interface RegisterPayload {
  username: string;
  email: string;
  password: string;
  password_confirm: string;
  full_name?: string;
}

// ── Profile & Evidence ───────────────────────────────────────────────────────

export interface UserProfile {
  user_id: string;
  name: string;
  target_role: string;
  education: string;
  experience_level?: string;
  skills: string[] | string;
  resume_file?: string | null;
  resume_parsed_text?: string;
  evidence?: SkillEvidence[];
  updated_at?: string;
}

export interface S3UploadResult {
  success: boolean;
  bucket: string;
  key: string;
  filename: string;
  s3_url: string;
  error?: string;
  mock?: boolean;
}

export interface SQSJobResult {
  success: boolean;
  message_id: string;
  payload: {
    type: string;
    bucket: string;
    key: string;
    user_id: string;
    filename: string;
    job_id: string;
  };
  error?: string;
  mock?: boolean;
}

export interface ResumeUploadResponse {
  message: string;
  file_name: string;
  resume_url: string;
  s3?: S3UploadResult;
  sqs?: SQSJobResult;
  profile: UserProfile;
}

export interface SkillEvidence {
  evidence_id?: string;
  id?: string;
  skill_name: string;
  evidence_type?: 'project' | 'self_reported' | 'assessment';
  title: string;
  reference?: string;
  description?: string;
  review_status?: 'verified' | 'unverified' | 'needs_improvement';
  status?: string;
  created_at?: string;
}


export interface Goal {
  goal_id: string;
  user_id: string;
  goal_type: GoalType;
  goal_text: string;
  target_profile_id?: string;
  target_date?: string | null;
  days_remaining?: number;
  study_hours_per_week?: number;
  created_at?: string;
}

export interface JobAnalysis {
  analysis_id: string;
  user_id?: string;
  mode?: ProductMode;
  role_title: string;
  job_text: string;
  job_image?: string | null;
  deadline_date?: string | null;
  days_remaining?: number;
  study_hours_per_week?: number;
  summary?: string;
  status?: 'pending' | 'completed' | 'failed';
  requirements?: Requirement[];
  feasibility?: FeasibilityAssessment;
  created_at?: string;
}

export interface Requirement {
  id?: string;
  requirement_id?: string;
  skill_name: string;
  category: string;
  importance: ImportanceType;
  source_excerpt: string;
  user_confirmed?: boolean;
}

export interface FeasibilityAssessment {
  available_hours: number;
  estimated_plan_effort_hours: number;
  days_remaining: number;
  study_hours_per_day: number;
  feasibility_band: FeasibilityBand;
  interpretation: string;
  assumptions: string[];
  suggested_scope?: string;
}

export interface MatchReport {
  report_id?: string;
  skill: string;
  skill_name?: string;
  status: SkillStatus;
  priority: PriorityLevel;
  reason: string;
  action?: string;
  recommended_action?: string;
  source_excerpt?: string;
  effort_hours_estimate?: number;
}

export interface CuratedResource {
  title: string;
  source: string;
  url: string;
  type?: 'docs' | 'tutorial' | 'spec' | 'exercise';
}

export interface RoadmapTask {
  id?: string;
  task_id?: string;
  title: string;
  target?: string;
  target_skill?: string;
  priority: PriorityLevel;
  status: 'pending' | 'in_progress' | 'completed';
  action_deliverable?: string;
  completion_definition?: string;
  effort_hours_estimate?: number;
  prerequisites?: string[];
  curated_resources?: CuratedResource[];
  expected_evidence?: string;
  due_date?: string | null;
  milestone?: string;
}

export interface ApplicationChecklistItem {
  id: string;
  title: string;
  description: string;
  completed: boolean;
  category: 'cv' | 'portfolio' | 'application' | 'interview_prep';
}

export interface AssessmentTask {
  task_id: string;
  title: string;
  task_type: string;
  target_skill: string;
  total_points: number;
  instructions: string;
  rubric: RubricCriterion[];
}

export interface RubricCriterion {
  criterion: string;
  points: number;
  description: string;
}

export interface AssessmentSubmission {
  valid_test: string;
  invalid_test: string;
  auth_test: string;
  assertions?: string;
  explanation?: string;
}
