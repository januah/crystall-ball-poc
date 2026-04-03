import { callAI } from './ai';
import { supabaseAdmin } from '@/lib/supabase/client';
import type { RawItem } from './scraper';

export interface UniqueOpportunity {
  title: string;
  sources: string[];
  source_urls: string[];
  raw_summary: string;
  mention_count: number;
}

export async function groupAndDeduplicate(
  items: RawItem[]
): Promise<UniqueOpportunity[]> {
  const itemsText = items
    .map(
      (item, i) =>
        `${i + 1}. [${item.source}] ${item.title}: ${item.excerpt ?? item.url}`
    )
    .join('\n');

  const prompt = `You are an AI assistant helping identify unique business opportunities.
Below is a list of items scraped from various tech sources today.
Group items that are about the same topic or product.
Return a JSON array of unique opportunities, each with:
- title: clear, concise opportunity title
- sources: array of source names that mentioned it
- source_urls: array of relevant URLs
- raw_summary: brief summary combining all source mentions
- mention_count: how many sources/items mentioned it

Return ONLY valid JSON, no markdown, no explanation.

Items:
${itemsText}`;

  const result = (await callAI(prompt, 'step3-dedup')) as UniqueOpportunity[];
  if (!Array.isArray(result)) {
    throw new Error('Step 3: AI returned non-array');
  }
  return result.slice(0, 20);
}

export async function fetchExistingOpportunities(): Promise<
  Array<{ id: string; title: string; slug: string }>
> {
  const { data, error } = await supabaseAdmin
    .from('opportunities')
    .select('id, title, slug')
    .order('last_updated_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('Failed to fetch existing opportunities:', error.message);
    return [];
  }
  return data ?? [];
}

export async function findMatchingOpportunity(
  newTitle: string,
  existingOpportunities: Array<{ id: string; title: string; slug: string }>
): Promise<{ id: string; slug: string } | null> {
  for (const existing of existingOpportunities) {
    const prompt = `You are comparing two business opportunity titles to determine if they refer to the same opportunity.

Title A: ${existing.title}
Title B: ${newTitle}

Are these the same opportunity? Consider semantic similarity, not just exact wording.
Reply with ONLY a JSON object:
{"is_same": true, "confidence": 0.95, "reason": "brief explanation"}
or
{"is_same": false, "confidence": 0.90, "reason": "brief explanation"}`;

    try {
      const result = (await callAI(prompt, 'step4-match')) as {
        is_same: boolean;
        confidence: number;
        reason: string;
      };
      if (result.is_same && result.confidence >= 0.8) {
        console.log(
          `[dedup] Matched "${newTitle}" → "${existing.title}" (confidence ${result.confidence})`
        );
        return { id: existing.id, slug: existing.slug };
      }
    } catch (err) {
      console.warn(
        `[dedup] Match check failed for "${existing.title}" vs "${newTitle}":`,
        err
      );
    }
  }
  return null;
}
