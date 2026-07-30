/**
 * Shared TypeScript types mirroring the backend API schemas.
 * Expanded per phase; Phase 0 only needs auth/role + the core enums for the design system.
 */

export type Role = "ANALYST" | "PARTNER";

export type CompanyStatus =
  | "NOT_CONTACTED"
  | "CONTACTED"
  | "RESPONDED"
  | "INTERESTED"
  | "DECLINED"
  | "BOUNCED";

export type ScheduleStatus = "AWAITING_INITIAL" | "ACTIVE" | "STOPPED";

export type CompanyType = "TARGET" | "BUYER" | "INVESTOR";

export type SourceQuality = "HIGH" | "MEDIUM" | "LOW";

export interface Firm {
  id: number;
  name: string;
}

export interface CurrentUser {
  id: number;
  full_name: string;
  email: string;
  role: Role;
  firm: Firm;
}

/** Standard paginated list envelope (plan.md §6.2). */
export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  page_size: number;
}

export type Source = "PROPRIETARY" | "PUBLIC" | "REFERRAL" | "IMPORTED";

export type CompanyCategory =
  | "STRATEGIC"
  | "PRIVATE_EQUITY"
  | "VENTURE_CAPITAL"
  | "FAMILY_OFFICE"
  | "FINANCIAL_SPONSOR"
  | "OTHER";

/** Firm-configurable counterparty category vocabulary (Phase 2a §7.2). */
export interface CompanyCategoryVocab {
  id: number;
  firm_id: number;
  name: string;
  code: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

/** Per-engagement ordered sourcing layer / band (Phase 2a §7.3). */
export interface SourcingLayer {
  id: number;
  firm_id: number;
  mandate_id: number;
  name: string;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PrimaryContact {
  id: number;
  contact_person: string;
  designation: string | null;
  email: string | null;
}

export interface Company {
  id: number;
  firm_id: number;
  mandate_id: number;
  company_name: string;
  hq: string | null;
  type: CompanyType;
  status: CompanyStatus;
  rationale: string | null;
  revenue_source: string | null;
  revenue_inr_cr: string | null;
  headcount: number | null;
  website: string | null;
  linkedin: string | null;
  relevant_investments: string | null;
  bucket: string | null;
  category: CompanyCategory;
  // Two-axis classification (Phase 2a §7). category_id is the source of truth;
  // *_name are resolved for display. Optional so older fixtures still typecheck.
  category_id?: number | null;
  category_name?: string | null;
  category_code?: string | null;
  sourcing_layer_id?: number | null;
  sourcing_layer_name?: string | null;
  profile_id?: number | null;
  source: Source;
  source_quality: SourceQuality;
  created_by_id: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Computed cadence fields (server-side only)
  schedule_status: ScheduleStatus | null;
  cycle_number: number | null;
  is_cold: boolean;
  initial_date: string | null;
  next_due_date: string | null;
  days_remaining: number | null;
  is_overdue: boolean;
  primary_contact: PrimaryContact | null;
}

export interface CompanySummary {
  responded_pct: number;
  overdue_count: number;
  needs_initial_count: number;
  by_status: Record<CompanyStatus, number>;
}

export interface CompanyListResponse {
  items: Company[];
  total: number;
  page: number;
  page_size: number;
  summary: CompanySummary;
}

export interface Contact {
  id: number;
  firm_id: number;
  company_id: number;
  contact_person: string;
  designation: string | null;
  email: string | null;
  phone: string | null;
  linkedin: string | null;
  reason: string | null;
  engagement: string | null;
  date_connected: string | null;
  mode: string | null;
  poc_owner_id: number | null;
  remark: string | null;
  sentiment: Sentiment | null;
  comments: string | null;
  is_primary: boolean;
  last_contact_date: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  // Resolved display fields from the firm-wide list endpoint (§8-E).
  company_name?: string | null;
  category_name?: string | null;
  poc_name?: string | null;
}

export type Sentiment = "POSITIVE" | "NEGATIVE" | "NEUTRAL";

export interface OutreachEvent {
  id: number;
  firm_id: number;
  company_id: number;
  schedule_id: number | null;
  contact_id: number | null;
  event_type: string;
  occurred_on: string;
  regarding: string | null;
  notes: string | null;
  mode: string | null;
  sentiment: Sentiment | null;
  owner_id: number | null;
  created_at: string;
}

export interface OutreachSchedule {
  id: number;
  firm_id: number;
  company_id: number;
  status: ScheduleStatus;
  initial_date: string | null;
  cadence_interval_days: number;
  regarding: string | null;
  stopped_reason: string | null;
  stopped_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface DuplicateWarning {
  company_id: number;
  company_name: string;
  mandate_id: number;
  status: CompanyStatus;
  initial_date: string | null;
  /** 0.0–1.0: 1.0 = exact match, <1.0 = fuzzy match */
  confidence: number;
  match_type: "exact_name" | "exact_domain" | "fuzzy_name";
}

export interface CompanyDetail extends Company {
  contacts: Contact[];
  events: OutreachEvent[];
  schedule: OutreachSchedule | null;
  duplicate_warnings: DuplicateWarning[];
}

export interface ContactDetail extends Contact {
  events: OutreachEvent[];
}

export interface ContactListResponse {
  items: Contact[];
  total: number;
}

// ── Mandates (Phase 7) ────────────────────────────────────────────────────────

export type MandateType = "SELL_SIDE" | "BUY_SIDE" | "CAPITAL_RAISE";
export type MandateStatus = "ACTIVE" | "ON_HOLD" | "CLOSED" | "TERMINATED";

export interface MandateStats {
  total: number;
  responded: number;
  needs_initial: number;
  responded_pct: number;
}

export interface Mandate {
  id: number;
  firm_id: number;
  project_id: number | null;
  client_name: string;
  name: string;
  type: MandateType;
  status: MandateStatus;
  exchange_rate: string | null;
  exchange_rate_date: string | null;
  lead_owner_id: number | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface MandateListItem extends Mandate, MandateStats {}

export interface MandateAssignmentUser {
  id: number;
  full_name: string;
  email: string;
  role: Role;
}

export interface MandateDetail extends Mandate {
  stats: MandateStats;
  assignments: MandateAssignmentUser[];
  lead_owner: { id: number; full_name: string; email: string } | null;
}

export interface FirmUser {
  id: number;
  full_name: string;
  email: string;
  role: Role;
}

// ── Projects (Phase "Work Like the Analyst Works") ────────────────────────────

/** Per-side (engagement-type) mix on a project list row. */
export interface ProjectSideMix {
  engagements: number;
  companies: number;
}

/** Assigned analyst on an engagement (id + name for initials + tooltips). */
export interface EngagementAnalyst {
  id: number;
  full_name: string;
}

export interface Project {
  id: number;
  firm_id: number;
  name: string;
  client_name: string;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  mandate_count?: number;
  // Health rollups resolved by GET /projects (optional so fixtures still typecheck).
  sides?: Record<MandateType, ProjectSideMix>;
  total_companies?: number;
  responded?: number;
  response_rate?: number;
  overdue_count?: number;
  cold_count?: number;
  needs_initial_count?: number;
  last_activity?: string | null;
  team?: string[];
}

export interface MandateEngagementStats {
  id: number;
  name: string;
  type: MandateType;
  status: MandateStatus;
  client_name: string;
  total_companies: number;
  responded: number;
  response_rate: number;
  overdue_count: number;
  cold_count: number;
  needs_initial_count: number;
  last_activity?: string | null;
  analysts?: EngagementAnalyst[];
}

export interface ProjectHeadline {
  total_companies: number;
  responded: number;
  response_rate: number;
  overdue_count: number;
  cold_count: number;
  needs_initial_count?: number;
  last_activity?: string | null;
}

export interface ProjectDetail extends Project {
  engagements: {
    SELL_SIDE: MandateEngagementStats[];
    BUY_SIDE: MandateEngagementStats[];
    CAPITAL_RAISE: MandateEngagementStats[];
  };
  headline: ProjectHeadline;
}

// ── Project Analytics (Slice 5) ────────────────────────────────────────────────

export interface EngagementAnalytics {
  id: number;
  name: string;
  type: MandateType;
  status: MandateStatus;
  total_companies: number;
  /** Companies actually emailed (total − never-contacted) — the reply-rate denominator. */
  contacted: number;
  /** Any answer: RESPONDED + INTERESTED + DECLINED. */
  replied: number;
  responded: number;
  bounced: number;
  emails_sent: number;
  response_rate: number;
  overdue_count: number;
  cold_count: number;
  needs_initial_count: number;
}

export interface ProjectAnalyticsHeadline {
  total_companies: number;
  contacted: number;
  replied: number;
  responded: number;
  bounced: number;
  emails_sent: number;
  response_rate: number;
  overdue_count: number;
  cold_count: number;
  needs_initial_count: number;
}

export interface ProjectAnalyticsItem {
  id: number;
  name: string;
  client_name: string;
  headline: ProjectAnalyticsHeadline;
  engagements: EngagementAnalytics[];
}

export interface ProjectAnalyticsResponse {
  items: ProjectAnalyticsItem[];
}

// ── Company profiles / firm-wide Master List (Phase 2a §8-A) ──────────────────

export interface ProfilePlacement {
  company_id: number;
  mandate_id: number;
  mandate_name: string | null;
  client_name: string | null;
  engagement_type: MandateType | null;
  category_name: string | null;
  status: CompanyStatus | null;
  analyst_id?: number | null;
  analyst_name?: string | null;
}

export interface CompanyProfile {
  id: number;
  company_name: string;
  hq: string | null;
  website: string | null;
  linkedin: string | null;
  headcount: number | null;
  revenue_source: string | null;
  revenue_inr_cr: string | null;
  domain_key: string | null;
  placements: ProfilePlacement[];
  engagement_count: number;
  /** Same company worked by more than one analyst (cross-analyst overlap). */
  overlap?: boolean;
}

export interface CompanyProfileListResponse {
  items: CompanyProfile[];
  total: number;
  page: number;
  page_size: number;
}

// ── Sourcing layer (funnel stages + candidates + pool) — SOURCING_LAYER_PLAN ──

export type SourcingStageKind =
  | "RESEARCH"
  | "SHORTLIST"
  | "ACTIVE"
  | "ENGAGED"
  | "PASSED"
  | "CUSTOM";

export type CandidateScoreStatus = "OK" | "STALE" | "FAILED";

export interface SourcingStage {
  id: number;
  firm_id: number;
  name: string;
  kind: SourcingStageKind;
  sort_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SourcingStageListResponse {
  items: SourcingStage[];
  total: number;
}

export interface CandidateScore {
  fit_score: number | null;
  band: string | null;
  subscores: Record<string, number> | null;
  rationale: string | null;
  insufficient_data: boolean;
  score_status: CandidateScoreStatus | null;
}

export interface SourcingCandidate extends CandidateScore {
  id: number;
  firm_id: number;
  mandate_id: number;
  profile_id: number;
  stage_id: number;
  company_id: number | null;
  added_by_id: number | null;
  stage_name?: string;
  stage_kind?: SourcingStageKind;
  prompt_log_initial?: boolean;
  stopped_cadence?: boolean;
}

export interface WarmHistory {
  mandate_id: number;
  mandate_name: string | null;
  client_name: string | null;
  visible: boolean;
  status: CompanyStatus | null;
  poc: string | null;
  sentiment: string | null;
  last_touch: string | null;
}

export interface SourcingPoolItem {
  profile_id: number;
  company_name: string;
  hq: string | null;
  website: string | null;
  linkedin: string | null;
  headcount: number | null;
  revenue_inr_cr: string | null;
  domain_key: string | null;
  candidate: SourcingCandidate | null;
  warm_history: WarmHistory[];
}

export interface SourcingPoolResponse {
  items: SourcingPoolItem[];
  total: number;
  page: number;
  page_size: number;
}

export type SavedSearchScope = "PRIVATE" | "FIRM";

export interface SavedSearch {
  id: number;
  firm_id: number;
  owner_id: number;
  name: string;
  scope: SavedSearchScope;
  criteria: Record<string, unknown>;
  created_at: string;
}

export type ImportSource = "CSV" | "IB_DB" | "PROVIDER";
export type ImportStatus = "PENDING" | "PREVIEWED" | "APPLIED" | "FAILED";

export interface ImportBatch {
  id: number;
  source: ImportSource;
  filename: string | null;
  row_count: number;
  created_count: number;
  updated_count: number;
  skipped_count: number;
  status: ImportStatus;
  created_at: string;
}

export type DataSourceKind = "ENRICHMENT" | "RANKING";

export interface DataSourceConfig {
  id: number;
  provider_key: string;
  kind: DataSourceKind;
  enabled: boolean;
  config: Record<string, unknown>;
}

// ── My-book worklist (SOURCING_LAYER_PLAN §3.5) ──────────────────────────────

export interface MyBookGroup {
  project_id: number | null;
  project_name: string | null;
  client_name: string | null;
  companies: Company[];
}

export interface MyBookResponse {
  groups: MyBookGroup[];
  total: number;
}

export interface AnalystOverlap {
  analyst_name: string;
  analyst_id: number | null;
  profiles: number;
}
