export type Category = 'Emerging Tech' | 'Emerging SaaS';
export type HypeType = 'Hype' | 'Traction';
export type SEAStatus = 'No SEA Competitor' | 'Competitor Exists';
export type AMASTPillar = 'AI' | 'Logistics' | 'RFID' | 'Sales & Distribution';
export type CurationStatus = 'Interested' | 'Rejected' | 'Follow Up' | 'Unreviewed';

export interface ScoreBreakdown {
  marketSize: number;
  innovation: number;
  seaFit: number;
  timing: number;
  competition: number;
  amastFit: number;
  total: number;
}

export interface TrendEntry {
  date: string;
  rank: number;
  score: number;
  hypeType: HypeType;
}

export interface Opportunity {
  id: string;
  rank: number;
  title: string;
  summary: string;
  fullSummary: string;
  category: Category;
  hypeType: HypeType;
  hypeExplanation: string;
  seaStatus: SEAStatus;
  seaAnalysis: string;
  amastAligned: boolean;
  amastPillars: AMASTPillar[];
  amastDetails: string;
  score: number;
  scoreBreakdown: ScoreBreakdown;
  dateDiscovered: string;
  curationStatus: CurationStatus;
  businessModel: string;
  velocityData: { month: string; score: number; isRecent: boolean }[];
  trendHistory: TrendEntry[];
  notes: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'Admin' | 'Analyst' | 'Viewer';
  status: 'Active' | 'Inactive';
}
