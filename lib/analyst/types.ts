// Types for the Market Intelligence Analyst report schema

export interface AnalystInput {
  opportunity_title: string;
  opportunity_description: string;
  amast_verticals: string[];
  sea_region?: string;
}

interface ScoreDimension {
  raw: number;
  weight: number;
  weighted: number;
}

export interface AnalystReport {
  ai_summary: {
    overview: string;
    gap_statement: string;
  };
  hype_vs_traction: {
    classification: 'hype' | 'traction' | 'emerging';
    rationale: string;
  };
  score: {
    velocity:          ScoreDimension;
    traction:          ScoreDimension;
    sea_competition:   ScoreDimension;
    amast_alignment:   ScoreDimension;
    market_size:       ScoreDimension;
    total:             number;
  };
  sea_competition: {
    status: 'No SEA Competitor' | 'Emerging Competition' | 'Competitive';
    analysis: string;
    global_analogues: string[];
  };
  amast_alignment: {
    verticals: string[];
    alignment_notes: Record<string, string>;
  };
  opportunity_depth: {
    problem_intensity: string;
    buyer_urgency: string;
    moat_potential: string;
    adjacent_expansion: string;
  };
  market_size_revenue: {
    sea_market_usd: string;
    safety_tooling_tam_pct: string;
    year3_arr_range: string;
    revenue_streams: Array<{
      name: string;
      rationale: string;
      priority: number;
    }>;
    recommended_entry: string;
  };
  customer_segmentation: Array<{
    tier: number;
    label: string;
    profile: string;
    acv_usd: string;
    sales_cycle: string;
  }>;
  system_implementation: {
    layers: Array<{
      number: number;
      name: string;
      components: string[];
    }>;
    recommended_stack: string;
    sea_deployment_notes: string;
  };
  product_hooks: Array<{
    name: string;
    description: string;
    hook_type: 'acquisition' | 'retention' | 'viral' | 'plg';
    rationale: string;
  }>;
  replication_playbook: Array<{
    step: number;
    title: string;
    body: string;
  }>;
  risk_register: Array<{
    severity: 'High' | 'Medium' | 'Low';
    name: string;
    description: string;
    mitigation: string;
  }>;
  business_model_estimate: {
    streams: string[];
    notes: string;
  };
  meta: {
    category: string;
    classification: string;
    sea_status: string;
    discovered_date: string;
  };
}
