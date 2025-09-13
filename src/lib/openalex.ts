import { OpenAlexGroup, OpenAlexFunder, OpenAlexTextResponse } from './types';

const OPENALEX_BASE = process.env.OPENALEX_BASE ?? 'https://api.openalex.org';
const OPENALEX_MAILTO = process.env.OPENALEX_MAILTO ?? 'you@example.org';

// Helper to build query parameters
export function qp(obj: Record<string, string | number | boolean | undefined>): string {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined && value !== null) {
      params.append(key, String(value));
    }
  }
  return params.toString();
}

// Sleep utility for retry delays
function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Fetch wrapper with retry logic and mailto
export async function oa(pathAndQuery: string): Promise<any> {
  const url = `${OPENALEX_BASE}${pathAndQuery}${pathAndQuery.includes('?') ? '&' : '?'}mailto=${encodeURIComponent(OPENALEX_MAILTO)}`;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'User-Agent': 'FunderScape/1.0',
        },
      });

      if (response.ok) {
        return await response.json();
      }

      // Handle rate limiting
      if (response.status === 429) {
        const retryAfter = response.headers.get('Retry-After');
        const delay = retryAfter ? parseInt(retryAfter) * 1000 : 2000 * attempt;
        console.log(`Rate limited, waiting ${delay}ms before retry ${attempt}`);
        await sleep(delay);
        continue;
      }

      // Handle server errors
      if (response.status >= 500) {
        const delay = 1000 * attempt;
        console.log(`Server error ${response.status}, waiting ${delay}ms before retry ${attempt}`);
        await sleep(delay);
        continue;
      }

      // For other errors, throw immediately
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
      if (attempt < 3) {
        const delay = 1000 * attempt;
        console.log(`Request failed, waiting ${delay}ms before retry ${attempt}:`, error);
        await sleep(delay);
      }
    }
  }

  throw new Error(`Failed after 3 attempts: ${lastError?.message}`);
}

// Specific API calls
export async function getTextTopics(title?: string, abstract?: string): Promise<OpenAlexTextResponse> {
  // Combine title and abstract for topic search
  const searchText = [title, abstract].filter(Boolean).join(' ');
  
  if (!searchText.trim()) {
    return { topics: [], primary_topic: undefined };
  }

  // First try the simple autocomplete approach
  const query = qp({
    q: searchText,
  });
  
  const response = await oa(`/autocomplete/topics?${query}`);
  const topics = response.results || [];

  // If we found topics with simple search, return them
  if (topics.length > 0) {
    return {
      topics: topics.slice(0, 5),
      primary_topic: topics[0],
    };
  }

  // If no topics found, try searching for works and extracting topics from them
  try {
    const worksQuery = qp({
      search: searchText,
      per_page: 10,
      select: 'topics',
    });

    const worksResponse = await oa(`/works?${worksQuery}`);
    const works = worksResponse.results || [];

    // Extract and count topics from found works
    const topicCounts = new Map<string, { id: string; display_name: string; count: number }>();
    
    works.forEach((work: any) => {
      if (work.topics) {
        work.topics.forEach((topic: any) => {
          const key = topic.id;
          if (topicCounts.has(key)) {
            topicCounts.get(key)!.count++;
          } else {
            topicCounts.set(key, {
              id: topic.id,
              display_name: topic.display_name,
              count: 1,
            });
          }
        });
      }
    });

    // Sort by frequency and return top topics
    const extractedTopics = Array.from(topicCounts.values())
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
      .map(topic => ({
        id: topic.id,
        display_name: topic.display_name,
        score: topic.count / works.length, // Normalize by number of works
      }));

    return {
      topics: extractedTopics,
      primary_topic: extractedTopics[0],
    };
  } catch (error) {
    console.warn('Failed to extract topics from works:', error);
    return { topics: [], primary_topic: undefined };
  }
}

export async function getTopFunders(topicIds: string[], fromYear: number): Promise<OpenAlexGroup[]> {
  const filter = `topics.id:${topicIds.join('|')},publication_year:${fromYear}-`;
  const query = qp({
    filter,
    'group_by': 'grants.funder',
    'per-page': 200,
    cursor: '*',
  });
  
  const response = await oa(`/works?${query}`);
  return response.group_by || [];
}

export async function getFunderNeighbors(funderId: string, topicIds: string[], fromYear: number): Promise<OpenAlexGroup[]> {
  const filter = `grants.funder:${funderId},topics.id:${topicIds.join('|')},publication_year:${fromYear}-`;
  const query = qp({
    filter,
    'group_by': 'grants.funder',
    'per-page': 200,
  });
  
  const response = await oa(`/works?${query}`);
  return response.group_by || [];
}

export async function getFunderProfile(funderId: string): Promise<OpenAlexFunder> {
  const query = qp({
    select: 'id,display_name,country_code,counts_by_year',
  });
  
  return oa(`/funders/${funderId}?${query}`);
}

export async function getFunderTopics(funderId: string, fromYear: number): Promise<OpenAlexGroup[]> {
  const filter = `grants.funder:${funderId},publication_year:${fromYear}-`;
  const query = qp({
    filter,
    'group_by': 'topics.id',
    'per-page': 200,
  });
  
  const response = await oa(`/works?${query}`);
  return response.group_by || [];
}

export async function getFunderCountries(funderId: string, fromYear: number): Promise<OpenAlexGroup[]> {
  const filter = `grants.funder:${funderId},publication_year:${fromYear}-`;
  const query = qp({
    filter,
    'group_by': 'authorships.institutions.country_code',
    'per-page': 200,
  });
  
  const response = await oa(`/works?${query}`);
  return response.group_by || [];
}

