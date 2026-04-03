import { scrapeAll, preFilter } from './scraper';
import {
  groupAndDeduplicate,
  fetchExistingOpportunities,
  findMatchingOpportunity,
  type UniqueOpportunity,
} from './deduplication';
import {
  calculateScores,
  generateSlug,
  rankAndFilter,
  type VelocityAnalysis,
  type SEAAnalysis,
  type AMASAlignment,
  type FullAnalysis,
  type ScoredOpportunity,
} from './scoring';
import { sendWhatsAppAlert } from './whatsapp';
import { callAI } from './ai';
import { supabaseAdmin } from '@/lib/supabase/client';
import { upsertOpportunity } from '@/lib/supabase/opportunities';

const BATCH_SIZE = 5;

async function processBatch<T, R>(
  items: T[],
  fn: (item: T) => Promise<R | null>,
  label: string
): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    const batchResults = await Promise.allSettled(batch.map(fn));
    batchResults.forEach((r, j) => {
      if (r.status === 'fulfilled' && r.value !== null) {
        results.push(r.value as R);
      } else if (r.status === 'rejected') {
        console.warn(`[${label}] Item ${i + j} failed:`, r.reason);
      }
    });
  }
  return results;
}

async function fetchAmastDomainsList(): Promise<string> {
  const { data, error } = await supabaseAdmin
    .from('amast_domains')
    .select('name, description')
    .eq('is_active', true);

  if (error || !data) return 'AI, Logistics, RFID, Sales & Distribution';
  return data
    .map((d: { name: string; description: string | null }) =>
      d.description ? `${d.name}: ${d.description}` : d.name
    )
    .join('\n');
}

async function fetchCategoryId(name: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('categories')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  return data?.id ?? null;
}

async function getOrCreateDataSourceId(name: string): Promise<string> {
  const { data: existing } = await supabaseAdmin
    .from('data_sources')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  if (existing) return existing.id as string;

  const { data: created, error } = await supabaseAdmin
    .from('data_sources')
    .insert({ name, is_active: true })
    .select('id')
    .single();
  if (error) throw new Error(`Failed to create data_source "${name}": ${error.message}`);
  return created.id as string;
}

async function getOrCreateDomainId(name: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('amast_domains')
    .select('id')
    .eq('name', name)
    .maybeSingle();
  return data?.id ?? null;
}

// ── Step 5: Velocity Analysis ────────────────────────────────────
async function analyseVelocity(opp: UniqueOpportunity): Promise<VelocityAnalysis> {
  const prompt = `Based on the following information about a tech/SaaS opportunity, estimate its momentum and velocity.

Opportunity: ${opp.title}
Sources mentioning it: ${opp.sources.join(', ')}
Mention count: ${opp.mention_count}
Raw context: ${opp.raw_summary}

Analyse and return ONLY a JSON object:
{
  "velocity_score": 65,
  "velocity_explanation": "brief explanation",
  "is_spike_last_2_weeks": true,
  "spike_explanation": "brief explanation",
  "trend_type": "traction",
  "trend_explanation": "brief explanation"
}

Scoring guide for velocity_score:
- 80-100: Explosive growth, viral, widely discussed
- 60-79: Strong momentum, growing fast
- 40-59: Moderate interest, steady growth
- 20-39: Early signals, limited mentions
- 0-19: Minimal activity`;

  return (await callAI(prompt, 'step5-velocity')) as VelocityAnalysis;
}

// ── Step 6: SEA Competition Analysis ─────────────────────────────
async function analyseSEA(opp: UniqueOpportunity): Promise<SEAAnalysis> {
  const prompt = `You are a business analyst specialising in Southeast Asia and Malaysia.

Opportunity: ${opp.title}
Description: ${opp.raw_summary}

Analyse whether similar solutions already exist in Southeast Asia (Malaysia, Singapore, Indonesia, Thailand, Philippines, Vietnam).

Return ONLY a JSON object:
{
  "sea_competitor_exists": false,
  "sea_competitor_notes": "list known competitors or explain why none exist",
  "malaysia_specific_notes": "specific situation in Malaysia",
  "opportunity_gap": "explanation of the gap if no competitor exists",
  "sea_competition_score": 75
}

Scoring guide for sea_competition_score:
- 80-100: No known competitors in SEA — wide open market
- 60-79: Limited competition, clear differentiation possible
- 40-59: Some competitors exist but market not saturated
- 20-39: Multiple competitors, crowded market
- 0-19: Market dominated by established players`;

  return (await callAI(prompt, 'step6-sea')) as SEAAnalysis;
}

// ── Step 7: AMAST Alignment Analysis ─────────────────────────────
async function analyseAMAST(
  opp: UniqueOpportunity,
  domainsList: string
): Promise<AMASAlignment> {
  const prompt = `AMAST is a software house in Malaysia specialising in:
${domainsList}

Opportunity: ${opp.title}
Description: ${opp.raw_summary}

Determine if and how this opportunity aligns with AMAST's capabilities.

Return ONLY a JSON object:
{
  "is_aligned": true,
  "aligned_domains": ["AI", "Logistics"],
  "alignment_notes": "explanation of alignment per domain",
  "replication_potential": "how AMAST could replicate or offer this as a service",
  "amast_alignment_score": 70
}

Scoring guide for amast_alignment_score:
- 80-100: Directly in AMAST's core capability, highly actionable
- 60-79: Strong overlap with existing capabilities
- 40-59: Moderate alignment, some capability building needed
- 20-39: Weak alignment, significant new investment required
- 0-19: No meaningful alignment`;

  return (await callAI(prompt, 'step7-amast')) as AMASAlignment;
}

// ── Step 8: Full Opportunity Analysis ────────────────────────────
async function analyseOpportunity(
  opp: UniqueOpportunity,
  velocity: VelocityAnalysis,
  sea: SEAAnalysis
): Promise<FullAnalysis> {
  const prompt = `You are a business intelligence analyst specialising in emerging technology and SaaS opportunities for Southeast Asia.

Opportunity: ${opp.title}
Context: ${opp.raw_summary}
Velocity: ${velocity.velocity_explanation}
Trend Type: ${velocity.trend_type}
SEA Competition: ${sea.sea_competitor_notes}

Generate a comprehensive analysis. Return ONLY a JSON object:
{
  "category": "Emerging SaaS",
  "ai_summary": "2-3 paragraph opportunity summary",
  "sea_adoption_analysis": "2-3 paragraph SEA feasibility analysis",
  "business_model_estimate": "detailed rough business model estimate",
  "hype_traction_explanation": "detailed explanation of hype vs traction classification",
  "market_size_estimate": "qualitative and quantitative market size estimate",
  "market_size_score": 65
}

Scoring guide for market_size_score:
- 80-100: Billion dollar market, global scale
- 60-79: Hundred million dollar market, regional scale
- 40-59: Tens of millions, niche but viable
- 20-39: Small market, limited scale
- 0-19: Micro niche, very limited opportunity`;

  return (await callAI(prompt, 'step8-analysis')) as FullAnalysis;
}

// ── Main Pipeline ────────────────────────────────────────────────
export interface PipelineResult {
  opportunities_found: number;
  opportunities_saved: number;
  whatsapp_alerts_sent: number;
  errors: string[];
}

export async function runPipeline(): Promise<PipelineResult> {
  const result: PipelineResult = {
    opportunities_found: 0,
    opportunities_saved: 0,
    whatsapp_alerts_sent: 0,
    errors: [],
  };

  // Step 1: Scrape
  console.log('[pipeline] Step 1: Scraping sources');
  const { items: rawItems, errors: scrapeErrors } = await scrapeAll();
  Object.entries(scrapeErrors).forEach(([src, err]) =>
    result.errors.push(`Scrape ${src}: ${err}`)
  );

  // Step 2: Pre-filter
  console.log('[pipeline] Step 2: Pre-filtering');
  const filtered = preFilter(rawItems);
  console.log(`[pipeline] ${filtered.length} items after pre-filter`);

  if (filtered.length === 0) {
    console.warn('[pipeline] No items after pre-filter, exiting early');
    return result;
  }

  // Step 3: AI deduplication & grouping
  console.log('[pipeline] Step 3: AI deduplication');
  let uniqueOpps: UniqueOpportunity[];
  try {
    uniqueOpps = await groupAndDeduplicate(filtered);
    console.log(`[pipeline] ${uniqueOpps.length} unique opportunities after dedup`);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    result.errors.push(`Step 3 dedup: ${msg}`);
    throw new Error(`Step 3 failed: ${msg}`);
  }

  result.opportunities_found = uniqueOpps.length;

  // Step 4: Check existing opportunities
  console.log('[pipeline] Step 4: Checking existing opportunities');
  const existingOpps = await fetchExistingOpportunities();
  const existingSlugSet = new Set(existingOpps.map((o) => o.slug));

  // Fetch shared lookup data
  const [amastDomainsList, emergingTechCatId, emergingSaasCatId] =
    await Promise.all([
      fetchAmastDomainsList(),
      fetchCategoryId('Emerging Tech'),
      fetchCategoryId('Emerging SaaS'),
    ]);

  // Steps 5–9: Analyse each opportunity in batches of 5
  console.log('[pipeline] Steps 5-9: Analysing opportunities');

  type AnalysedItem = {
    opp: UniqueOpportunity;
    velocity: VelocityAnalysis;
    sea: SEAAnalysis;
    amast: AMASAlignment;
    analysis: FullAnalysis;
    scores: ReturnType<typeof calculateScores>;
    slug: string;
    is_new: boolean;
    existing_id?: string;
    existing_slug?: string;
  };

  const analysed = await processBatch<UniqueOpportunity, AnalysedItem>(
    uniqueOpps,
    async (opp) => {
      // Step 4 (inline): find existing match
      const match = await findMatchingOpportunity(opp.title, existingOpps);

      // Steps 5–7 in parallel
      const [velocity, sea, amast] = await Promise.all([
        analyseVelocity(opp),
        analyseSEA(opp),
        analyseAMAST(opp, amastDomainsList),
      ]);

      // Step 8: Full analysis (needs velocity + sea)
      const analysis = await analyseOpportunity(opp, velocity, sea);

      // Step 9: Score calculation
      const scores = calculateScores({ velocity, sea, amast, analysis });

      const slug =
        match?.slug ?? generateSlug(opp.title, existingSlugSet);

      // Register new slug to prevent intra-run collisions
      if (!match) existingSlugSet.add(slug);

      return {
        opp,
        velocity,
        sea,
        amast,
        analysis,
        scores,
        slug,
        is_new: !match,
        existing_id: match?.id,
        existing_slug: match?.slug,
      };
    },
    'step5-9-analysis'
  );

  // Step 9: Rank and keep top 10
  console.log('[pipeline] Step 9: Ranking');
  const scored: ScoredOpportunity[] = analysed.map((a) => ({
    ...a.opp,
    velocity: a.velocity,
    sea: a.sea,
    amast: a.amast,
    analysis: a.analysis,
    ...a.scores,
    slug: a.slug,
    rank_position: 0,
    is_new: a.is_new,
    existing_id: a.existing_id,
    existing_slug: a.existing_slug,
  }));

  const top10 = rankAndFilter(scored);
  console.log(`[pipeline] Top ${top10.length} opportunities selected`);

  // Step 10: Upsert to Supabase
  console.log('[pipeline] Step 10: Upserting to Supabase');

  for (const opp of top10) {
    try {
      const categoryId =
        opp.analysis.category === 'Emerging Tech'
          ? emergingTechCatId
          : emergingSaasCatId;

      const sourceIds = await Promise.all(
        opp.sources.map(getOrCreateDataSourceId)
      );

      const domainIds = (
        await Promise.all(opp.amast.aligned_domains.map(getOrCreateDomainId))
      ).filter((id): id is string => id !== null);

      await upsertOpportunity({
        title: opp.title,
        slug: opp.slug,
        category_id: categoryId ?? null,
        trend_type: opp.velocity.trend_type,
        sea_competitor_exists: opp.sea.sea_competitor_exists,
        sea_competitor_notes: opp.sea.sea_competitor_notes,
        ai_summary: opp.analysis.ai_summary,
        sea_adoption_analysis: opp.analysis.sea_adoption_analysis,
        business_model_estimate: opp.analysis.business_model_estimate,
        hype_traction_explanation: opp.analysis.hype_traction_explanation,
        market_size_estimate: opp.analysis.market_size_estimate,
        score_velocity: opp.score_velocity,
        score_traction: opp.score_traction,
        score_sea_competition: opp.score_sea_competition,
        score_amast_alignment: opp.score_amast_alignment,
        score_market_size: opp.score_market_size,
        rank_position: opp.rank_position,
        sources: sourceIds.map((source_id, i) => ({
          source_id,
          source_url: opp.source_urls[i] ?? null,
          contribution_note: null,
        })),
        alignments: domainIds.map((domain_id) => ({
          domain_id,
          alignment_notes: opp.amast.alignment_notes,
        })),
      });

      result.opportunities_saved++;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`[pipeline] Failed to upsert "${opp.title}":`, msg);
      result.errors.push(`Upsert "${opp.title}": ${msg}`);
    }
  }

  // Step 11: WhatsApp alerts
  console.log('[pipeline] Step 11: Sending WhatsApp alerts');
  for (const opp of top10) {
    if (opp.velocity.is_spike_last_2_weeks && !opp.sea.sea_competitor_exists) {
      try {
        await sendWhatsAppAlert({
          rank: opp.rank_position,
          title: opp.title,
          score_total: opp.score_total,
          velocity_explanation: opp.velocity.velocity_explanation,
          opportunity_gap: opp.sea.opportunity_gap,
          alignment_notes: opp.amast.alignment_notes,
          slug: opp.slug,
        });
        result.whatsapp_alerts_sent++;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[pipeline] WhatsApp alert failed for "${opp.title}":`, msg);
        result.errors.push(`WhatsApp "${opp.title}": ${msg}`);
      }
    }
  }

  return result;
}
