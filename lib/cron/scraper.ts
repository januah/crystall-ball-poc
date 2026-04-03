import { load } from 'cheerio';
import { subMonths } from 'date-fns';

export interface RawItem {
  title: string;
  url: string;
  source: string;
  score?: number;
  comments?: number;
  excerpt?: string;
  date?: string;
  tags?: string[];
  authors?: string[];
}

const USER_AGENT = 'Mozilla/5.0 (compatible; CrystalBallBot/1.0)';
const SIX_MONTHS_AGO = subMonths(new Date(), 6);

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
const randomDelay = () => sleep(2000 + Math.random() * 1000);

async function fetchHTML(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status} fetching ${url}`);
  return res.text();
}

function isWithin6Months(dateStr: string | undefined): boolean {
  if (!dateStr) return true; // include if date unknown
  const d = new Date(dateStr);
  return !isNaN(d.getTime()) && d >= SIX_MONTHS_AGO;
}

// ── 1. Hacker News ────────────────────────────────────────────────
async function scrapeHackerNews(): Promise<RawItem[]> {
  const items: RawItem[] = [];
  for (const path of ['/newest', '/best']) {
    await randomDelay();
    const html = await fetchHTML(`https://news.ycombinator.com${path}`);
    const $ = load(html);
    $('.athing').each((_, el) => {
      const titleEl = $(el).find('.titleline > a').first();
      const title = titleEl.text().trim();
      const url = titleEl.attr('href') ?? '';
      const subtext = $(el).next('.spacer').next('tr').find('.subtext');
      const points = parseInt(subtext.find('.score').text(), 10) || 0;
      const commentText = subtext.find('a').last().text();
      const comments = parseInt(commentText, 10) || 0;
      if (title && url) {
        items.push({ title, url, source: 'Hacker News', score: points, comments });
      }
    });
  }
  return items;
}

// ── 2. Reddit ────────────────────────────────────────────────────
async function scrapeReddit(): Promise<RawItem[]> {
  const subreddits = ['SaaS', 'entrepreneur', 'artificial', 'technology'];
  const items: RawItem[] = [];
  for (const sub of subreddits) {
    await randomDelay();
    const res = await fetch(
      `https://www.reddit.com/r/${sub}/top.json?t=week&limit=25`,
      { headers: { 'User-Agent': USER_AGENT } }
    );
    if (!res.ok) continue;
    const json = await res.json();
    const posts = json?.data?.children ?? [];
    for (const { data: p } of posts) {
      if (!p.title || !p.url) continue;
      const date = p.created_utc
        ? new Date(p.created_utc * 1000).toISOString()
        : undefined;
      items.push({
        title: p.title,
        url: `https://reddit.com${p.permalink}`,
        source: `Reddit r/${sub}`,
        score: p.score,
        comments: p.num_comments,
        excerpt: p.selftext?.slice(0, 200) || undefined,
        date,
      });
    }
  }
  return items;
}

// ── 3. GitHub Trending ────────────────────────────────────────────
async function scrapeGitHubTrending(): Promise<RawItem[]> {
  await randomDelay();
  const html = await fetchHTML('https://github.com/trending');
  const $ = load(html);
  const items: RawItem[] = [];
  $('article.Box-row').each((_, el) => {
    const nameEl = $(el).find('h2 a');
    const repoPath = nameEl.attr('href')?.replace(/^\//, '') ?? '';
    const title = repoPath.replace('/', ' / ');
    const description = $(el).find('p').first().text().trim();
    const starsText = $(el)
      .find('[href$="/stargazers"]')
      .text()
      .trim()
      .replace(/,/g, '');
    const forksText = $(el)
      .find('[href$="/forks"]')
      .text()
      .trim()
      .replace(/,/g, '');
    const language = $(el)
      .find('[itemprop="programmingLanguage"]')
      .text()
      .trim();
    if (repoPath) {
      items.push({
        title: title || repoPath,
        url: `https://github.com/${repoPath}`,
        source: 'GitHub Trending',
        score: parseInt(starsText, 10) || 0,
        comments: parseInt(forksText, 10) || 0,
        excerpt: description || undefined,
        tags: language ? [language] : [],
      });
    }
  });
  return items;
}

// ── 4. Product Hunt ───────────────────────────────────────────────
async function scrapeProductHunt(): Promise<RawItem[]> {
  await randomDelay();
  const html = await fetchHTML('https://www.producthunt.com');
  const $ = load(html);
  const items: RawItem[] = [];

  $('[data-test="homepage-section-0"] [data-test^="post-item"]').each((_, el) => {
    const title = $(el).find('strong, h3').first().text().trim();
    const tagline = $(el).find('p').first().text().trim();
    const href = $(el).find('a').first().attr('href') ?? '';
    const url = href.startsWith('http') ? href : `https://www.producthunt.com${href}`;
    const votesText = $(el).find('[data-test="vote-button"]').text().trim();
    if (title) {
      items.push({
        title,
        url,
        source: 'Product Hunt',
        score: parseInt(votesText, 10) || 0,
        excerpt: tagline || undefined,
      });
    }
  });

  // Fallback selector
  if (items.length === 0) {
    $('a[href^="/posts/"]').each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href') ?? '';
      if (title && href && !items.find((i) => i.url.includes(href))) {
        items.push({
          title,
          url: `https://www.producthunt.com${href}`,
          source: 'Product Hunt',
        });
      }
    });
  }

  return items.slice(0, 25);
}

// ── 5. TechCrunch ────────────────────────────────────────────────
async function scrapeTechCrunch(): Promise<RawItem[]> {
  await randomDelay();
  const html = await fetchHTML('https://techcrunch.com');
  const $ = load(html);
  const items: RawItem[] = [];
  $('article, .post-block').each((_, el) => {
    const titleEl = $(el).find('h2 a, h3 a, .post-block__title a').first();
    const title = titleEl.text().trim();
    const url = titleEl.attr('href') ?? '';
    const excerpt = $(el).find('p, .post-block__content').first().text().trim();
    const dateStr = $(el).find('time').attr('datetime');
    if (title && url && isWithin6Months(dateStr)) {
      items.push({
        title,
        url,
        source: 'TechCrunch',
        excerpt: excerpt.slice(0, 200) || undefined,
        date: dateStr,
      });
    }
  });
  return items;
}

// ── 6. MIT Technology Review ──────────────────────────────────────
async function scrapeMITTechReview(): Promise<RawItem[]> {
  await randomDelay();
  const html = await fetchHTML('https://www.technologyreview.com');
  const $ = load(html);
  const items: RawItem[] = [];
  $('article, .story, [class*="card"]').each((_, el) => {
    const titleEl = $(el).find('h2 a, h3 a, h1 a').first();
    const title = titleEl.text().trim();
    let url = titleEl.attr('href') ?? '';
    if (url && !url.startsWith('http'))
      url = `https://www.technologyreview.com${url}`;
    const excerpt = $(el).find('p').first().text().trim();
    const dateStr = $(el).find('time').attr('datetime');
    if (title && url && isWithin6Months(dateStr)) {
      items.push({
        title,
        url,
        source: 'MIT Technology Review',
        excerpt: excerpt.slice(0, 200) || undefined,
        date: dateStr,
      });
    }
  });
  return items;
}

// ── 7. ArXiv ─────────────────────────────────────────────────────
async function scrapeArXiv(): Promise<RawItem[]> {
  const items: RawItem[] = [];
  for (const section of ['cs.AI', 'cs.LG']) {
    await randomDelay();
    const html = await fetchHTML(`https://arxiv.org/list/${section}/recent`);
    const $ = load(html);
    const titleEls = $('dt');
    const detailEls = $('dd');
    titleEls.each((i, dt) => {
      const dd = detailEls.eq(i);
      const anchor = $(dt).find('a[href^="/abs/"]').first();
      const arxivPath = anchor.attr('href') ?? '';
      const url = arxivPath ? `https://arxiv.org${arxivPath}` : '';
      const title = dd.find('.list-title').text().replace('Title:', '').trim();
      const abstract =
        dd.find('.mathjax').text().trim() ||
        dd.find('.abstract').text().replace('Abstract:', '').trim();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const authors = dd
        .find('.list-authors a')
        .map((_: number, a: any) => $(a).text().trim())
        .get()
        .join(', ');
      if (title && url) {
        items.push({
          title,
          url,
          source: `ArXiv ${section}`,
          excerpt: abstract.slice(0, 300) || undefined,
          authors: authors ? [authors] : [],
        });
      }
    });
  }
  return items;
}

// ── 8. Dev.to ────────────────────────────────────────────────────
async function scrapeDevTo(): Promise<RawItem[]> {
  await randomDelay();
  const res = await fetch('https://dev.to/api/articles?per_page=30&top=7', {
    headers: { 'User-Agent': USER_AGENT },
  });
  if (!res.ok) return [];
  const articles: any[] = await res.json();
  return articles
    .filter((a) => isWithin6Months(a.published_at))
    .map((a) => ({
      title: a.title,
      url: a.url,
      source: 'Dev.to',
      score: a.positive_reactions_count,
      comments: a.comments_count,
      tags: a.tag_list ?? [],
      date: a.published_at,
    }));
}

// ── 9. IndieHackers ───────────────────────────────────────────────
async function scrapeIndieHackers(): Promise<RawItem[]> {
  await randomDelay();
  const html = await fetchHTML('https://www.indiehackers.com');
  const $ = load(html);
  const items: RawItem[] = [];
  $('article, [class*="post"], [class*="story"]').each((_, el) => {
    const titleEl = $(el).find('h2 a, h3 a, a[class*="title"]').first();
    const title = titleEl.text().trim();
    let url = titleEl.attr('href') ?? '';
    if (url && !url.startsWith('http'))
      url = `https://www.indiehackers.com${url}`;
    const votesText = $(el).find('[class*="vote"], [class*="like"]').text().trim();
    const commentText = $(el).find('[class*="comment"]').text().trim();
    if (title && url) {
      items.push({
        title,
        url,
        source: 'IndieHackers',
        score: parseInt(votesText, 10) || 0,
        comments: parseInt(commentText, 10) || 0,
      });
    }
  });
  return items;
}

// ── Aggregator ────────────────────────────────────────────────────
export interface ScrapeResult {
  items: RawItem[];
  errors: Record<string, string>;
}

export async function scrapeAll(): Promise<ScrapeResult> {
  const scrapers: Array<[string, () => Promise<RawItem[]>]> = [
    ['Hacker News', scrapeHackerNews],
    ['Reddit', scrapeReddit],
    ['GitHub Trending', scrapeGitHubTrending],
    ['Product Hunt', scrapeProductHunt],
    ['TechCrunch', scrapeTechCrunch],
    ['MIT Technology Review', scrapeMITTechReview],
    ['ArXiv', scrapeArXiv],
    ['Dev.to', scrapeDevTo],
    ['IndieHackers', scrapeIndieHackers],
  ];

  const results = await Promise.allSettled(scrapers.map(([, fn]) => fn()));

  const items: RawItem[] = [];
  const errors: Record<string, string> = {};

  results.forEach((result, i) => {
    const [name] = scrapers[i];
    if (result.status === 'fulfilled') {
      console.log(`[scraper] ${name}: ${result.value.length} items`);
      items.push(...result.value);
    } else {
      const msg =
        result.reason instanceof Error
          ? result.reason.message
          : String(result.reason);
      console.error(`[scraper] ${name} failed:`, msg);
      errors[name] = msg;
    }
  });

  // Deduplicate by URL within this run
  const seenUrls = new Set<string>();
  const deduped = items.filter((item) => {
    if (!item.url || seenUrls.has(item.url)) return false;
    seenUrls.add(item.url);
    return true;
  });

  console.log(
    `[scraper] Total: ${deduped.length} unique items from ${items.length} raw`
  );
  return { items: deduped, errors };
}

// ── Keyword pre-filter ────────────────────────────────────────────
const KEYWORDS = [
  'saas', 'software', 'platform', 'ai', 'machine learning', 'automation',
  'productivity', 'logistics', 'rfid', 'supply chain', 'analytics', 'api',
  'marketplace', 'tool', 'app', 'service', 'startup', 'launch', 'product',
  'artificial intelligence', 'llm', 'gpt', 'agent', 'workflow', 'enterprise',
];

export function preFilter(items: RawItem[]): RawItem[] {
  return items.filter((item) => {
    const text =
      `${item.title} ${item.excerpt ?? ''} ${(item.tags ?? []).join(' ')}`.toLowerCase();
    return KEYWORDS.some((kw) => text.includes(kw));
  });
}
