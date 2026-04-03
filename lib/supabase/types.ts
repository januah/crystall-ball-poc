// =============================================================
// Crystal Ball — Supabase TypeScript Types
// Generated from schema.sql — keep in sync with migrations.
// =============================================================

// ------------------------------------------------------------------
// roles
// ------------------------------------------------------------------
export type RoleRow = {
  id: string;
  name: 'admin' | 'analyst' | 'viewer';
  description: string | null;
  created_at: string;
};

export type RoleInsert = Omit<RoleRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type RoleUpdate = Partial<RoleInsert>;

// ------------------------------------------------------------------
// users
// ------------------------------------------------------------------
export type UserRow = {
  id: string;
  email: string;
  password_hash: string;
  role_id: string | null;
  full_name: string | null;
  department: string | null;
  avatar_url: string | null;
  is_active: boolean;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  last_login_at: string | null;
};

export type UserInsert = Omit<UserRow, 'id' | 'created_at' | 'updated_at'> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type UserUpdate = Partial<Omit<UserInsert, 'email'>>;

/** Safe user type — never exposes password_hash to the client */
export type UserSafe = Omit<UserRow, 'password_hash'> & {
  role?: RoleRow;
};

// ------------------------------------------------------------------
// categories
// ------------------------------------------------------------------
export type CategoryRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type CategoryInsert = Omit<CategoryRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type CategoryUpdate = Partial<CategoryInsert>;

// ------------------------------------------------------------------
// amast_domains
// ------------------------------------------------------------------
export type AmastDomainRow = {
  id: string;
  name: string;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type AmastDomainInsert = Omit<AmastDomainRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type AmastDomainUpdate = Partial<AmastDomainInsert>;

// ------------------------------------------------------------------
// data_sources
// ------------------------------------------------------------------
export type DataSourceRow = {
  id: string;
  name: string;
  url: string | null;
  description: string | null;
  is_active: boolean;
  created_at: string;
};

export type DataSourceInsert = Omit<DataSourceRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type DataSourceUpdate = Partial<DataSourceInsert>;

// ------------------------------------------------------------------
// opportunities
// ------------------------------------------------------------------
export type OpportunityRow = {
  id: string;
  title: string;
  slug: string;
  category_id: string | null;
  trend_type: 'hype' | 'traction' | null;
  sea_competitor_exists: boolean;
  sea_competitor_notes: string | null;
  ai_summary: string | null;
  sea_adoption_analysis: string | null;
  business_model_estimate: string | null;
  hype_traction_explanation: string | null;
  market_size_estimate: string | null;
  score_velocity: number | null;
  score_traction: number | null;
  score_sea_competition: number | null;
  score_amast_alignment: number | null;
  score_market_size: number | null;
  score_total: number | null;        // computed by trigger
  rank_position: number | null;
  first_discovered_at: string;
  last_updated_at: string;
  created_at: string;
};

export type OpportunityInsert = Omit<
  OpportunityRow,
  'id' | 'score_total' | 'created_at' | 'first_discovered_at' | 'last_updated_at'
> & {
  id?: string;
  created_at?: string;
  first_discovered_at?: string;
  last_updated_at?: string;
  // score_total is intentionally excluded — computed by trigger
};

export type OpportunityUpdate = Partial<OpportunityInsert>;

// ------------------------------------------------------------------
// opportunity_trend_history
// ------------------------------------------------------------------
export type TrendHistoryRow = {
  id: string;
  opportunity_id: string;
  run_date: string;           // ISO date string 'YYYY-MM-DD'
  rank_position: number | null;
  score_velocity: number | null;
  score_traction: number | null;
  score_sea_competition: number | null;
  score_amast_alignment: number | null;
  score_market_size: number | null;
  score_total: number | null; // computed by trigger
  trend_type: string | null;
  sea_competitor_exists: boolean | null;
  created_at: string;
};

export type TrendHistoryInsert = Omit<TrendHistoryRow, 'id' | 'score_total' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type TrendHistoryUpdate = Partial<TrendHistoryInsert>;

// ------------------------------------------------------------------
// opportunity_sources
// ------------------------------------------------------------------
export type OpportunitySourceRow = {
  id: string;
  opportunity_id: string;
  source_id: string;
  source_url: string | null;
  contribution_note: string | null;
  discovered_at: string;
};

export type OpportunitySourceInsert = Omit<OpportunitySourceRow, 'id' | 'discovered_at'> & {
  id?: string;
  discovered_at?: string;
};

export type OpportunitySourceUpdate = Partial<OpportunitySourceInsert>;

/** With joined data_source record */
export type OpportunitySourceWithSource = OpportunitySourceRow & {
  data_source: DataSourceRow;
};

// ------------------------------------------------------------------
// opportunity_amast_alignments
// ------------------------------------------------------------------
export type OpportunityAlignmentRow = {
  id: string;
  opportunity_id: string;
  domain_id: string;
  alignment_notes: string | null;
  created_at: string;
};

export type OpportunityAlignmentInsert = Omit<OpportunityAlignmentRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

export type OpportunityAlignmentUpdate = Partial<OpportunityAlignmentInsert>;

/** With joined amast_domain record */
export type OpportunityAlignmentWithDomain = OpportunityAlignmentRow & {
  amast_domain: AmastDomainRow;
};

// ------------------------------------------------------------------
// opportunity_curation
// ------------------------------------------------------------------
export type CurationStatus = 'interested' | 'rejected' | 'follow_up' | 'unreviewed';

export type OpportunityCurationRow = {
  id: string;
  opportunity_id: string;
  user_id: string;
  status: CurationStatus;
  created_at: string;
  updated_at: string;
};

export type OpportunityCurationInsert = Omit<
  OpportunityCurationRow,
  'id' | 'created_at' | 'updated_at'
> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type OpportunityCurationUpdate = Partial<Pick<OpportunityCurationInsert, 'status'>>;

// ------------------------------------------------------------------
// opportunity_notes
// ------------------------------------------------------------------
export type OpportunityNoteRow = {
  id: string;
  opportunity_id: string;
  user_id: string;
  note_text: string;
  version: number;
  is_latest: boolean;
  created_at: string;
};

export type OpportunityNoteInsert = Omit<OpportunityNoteRow, 'id' | 'created_at'> & {
  id?: string;
  created_at?: string;
};

// Notes are append-only — no Update type.

// ------------------------------------------------------------------
// Composite / joined types
// ------------------------------------------------------------------

/** Full opportunity detail — all related data joined */
export type OpportunityFull = OpportunityRow & {
  category: CategoryRow | null;
  amast_alignments: OpportunityAlignmentWithDomain[];
  sources: OpportunitySourceWithSource[];
  trend_history: TrendHistoryRow[];
};

/** Opportunity list item — includes user's own curation status */
export type OpportunityWithCuration = OpportunityRow & {
  category: CategoryRow | null;
  curation: OpportunityCurationRow | null;
};

/** Full opportunity detail + user context (curation + latest note) */
export type OpportunityDetail = OpportunityFull & {
  curation: OpportunityCurationRow | null;
  latest_note: OpportunityNoteRow | null;
};

/** Public-safe opportunity — no curation or notes */
export type OpportunityPublic = Pick<
  OpportunityRow,
  | 'id'
  | 'title'
  | 'slug'
  | 'trend_type'
  | 'sea_competitor_exists'
  | 'ai_summary'
  | 'sea_adoption_analysis'
  | 'business_model_estimate'
  | 'market_size_estimate'
  | 'score_velocity'
  | 'score_traction'
  | 'score_sea_competition'
  | 'score_amast_alignment'
  | 'score_market_size'
  | 'score_total'
  | 'rank_position'
  | 'first_discovered_at'
  | 'last_updated_at'
> & {
  category: Pick<CategoryRow, 'id' | 'name'> | null;
  amast_alignments: Array<{
    domain: Pick<AmastDomainRow, 'id' | 'name'>;
    alignment_notes: string | null;
  }>;
};

// ------------------------------------------------------------------
// Session / Auth types
// ------------------------------------------------------------------
export type SessionUser = {
  id: string;
  email: string;
  full_name: string | null;
  role: 'admin' | 'analyst' | 'viewer';
  role_id: string;
  is_active: boolean;
};

export type LoginCredentials = {
  email: string;
  password: string;
};

export type AuthResult =
  | { success: true; user: SessionUser; token: string }
  | { success: false; error: string };
