import { 
  getTopFunders, 
  getFunderNeighbors, 
  getFunderProfile, 
  getFunderTopics, 
  getFunderCountries
} from './openalex';
import { 
  GraphNode, 
  GraphEdge, 
  GraphResponse, 
  FunderGroup, 
  TopicMix, 
  CountryMix 
} from './types';

// Configuration from environment
const FUNDER_YEARS = parseInt(process.env.FUNDER_YEARS ?? '5');
const TOPK_FUNDERS = parseInt(process.env.TOPK_FUNDERS ?? '25');
const MIN_EDGE = parseInt(process.env.MIN_EDGE ?? '2');

// Helper to normalize funder IDs for edge keys
function norm(id: string): string {
  return id.replace(/^F/, '');
}

// Helper to check if funder is in seed set
function inSeeds(id: string, seeds: FunderGroup[]): boolean {
  return seeds.some(seed => seed.key === id);
}

// Helper to deduplicate funder IDs
function dedupeIDs(ids: string[]): string[] {
  return Array.from(new Set(ids));
}

// Helper to create edge key (symmetric)
function createEdgeKey(id1: string, id2: string): string {
  const a = norm(id1);
  const b = norm(id2);
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

// Get top funders for given topics
async function groupFunders(topicIds: string[], fromYear: number): Promise<FunderGroup[]> {
  const groups = await getTopFunders(topicIds, fromYear);
  return groups.map(g => ({ key: g.key, count: g.count }));
}

// Get co-funding neighbors for a specific funder
async function groupNeighbors(funderId: string, topicIds: string[], fromYear: number): Promise<FunderGroup[]> {
  const groups = await getFunderNeighbors(funderId, topicIds, fromYear);
  return groups.map(g => ({ key: g.key, count: g.count }));
}

// Enrich funders with additional data
async function enrichFunders(ids: string[], fromYear: number): Promise<GraphNode[]> {
  const nodes: GraphNode[] = [];
  
  // Process funders one by one to avoid rate limiting
  for (const id of ids) {
    try {
      // Get basic profile first
      const profile = await getFunderProfile(id);
      
      // Small delay between API calls
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Try to get additional data, but don't fail if it doesn't work
      let topics: TopicMix[] = [];
      let countries: CountryMix[] = [];
      
      try {
        const [topicGroups, countryGroups] = await Promise.all([
          getFunderTopics(id, fromYear),
          getFunderCountries(id, fromYear),
        ]);
        
        // Transform topic groups to TopicMix using key_display_name
        topics = topicGroups
          .slice(0, 5) // Top 5 topics
          .map(tg => ({
            id: tg.key,
            name: tg.key_display_name ?? tg.key.split('/').pop() ?? tg.key,
            count: tg.count,
          }));
        
        // Transform country groups to CountryMix
        countries = countryGroups
          .filter(cg => cg.key && cg.key !== '') // Filter out empty country codes
          .slice(0, 5) // Top 5 countries
          .map(cg => ({
            code: cg.key,
            count: cg.count,
          }));
      } catch (enrichError) {
        console.warn(`Failed to get enrichment data for ${id}, using basic profile only`);
      }
      
      nodes.push({
        id,
        name: profile.display_name,
        country: profile.country_code,
        count: 0, // Will be set from seed data
        trend: profile.counts_by_year,
        topics,
        countries,
      });
      
    } catch (error) {
      console.error(`Failed to get profile for funder ${id}:`, error);
      // Return minimal node on error
      nodes.push({
        id,
        name: `Funder ${id.split('/').pop() || id}`,
        country: null,
        count: 0,
      });
    }
  }
  
  return nodes;
}

// Main graph building function
export async function buildGraph({
  topicIds,
  fromYear,
  topK = TOPK_FUNDERS,
  minEdge = MIN_EDGE,
}: {
  topicIds: string[];
  fromYear: number;
  topK?: number;
  minEdge?: number;
}): Promise<GraphResponse> {
  console.log(`Building graph for topics: ${topicIds.join(', ')} from year ${fromYear}`);
  
  // 1) Get top funders
  const groups = await groupFunders(topicIds, fromYear);
  const seeds = groups.slice(0, topK);
  console.log(`Found ${seeds.length} top funders`);
  
  // 2) Build co-funding edges
  const edges: Record<string, number> = {};
  const batchSize = 3;
  
  for (let i = 0; i < seeds.length; i += batchSize) {
    const batch = seeds.slice(i, i + batchSize);
    
    const batchPromises = batch.map(async (seed) => {
      try {
        const neighbors = await groupNeighbors(seed.key, topicIds, fromYear);
        
        for (const neighbor of neighbors) {
          if (inSeeds(neighbor.key, seeds) && neighbor.key !== seed.key) {
            const edgeKey = createEdgeKey(seed.key, neighbor.key);
            edges[edgeKey] = (edges[edgeKey] ?? 0) + neighbor.count;
          }
        }
      } catch (error) {
        console.error(`Failed to get neighbors for ${seed.key}:`, error);
      }
    });
    
    await Promise.all(batchPromises);
    
    // Small delay between batches
    if (i + batchSize < seeds.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log(`Found ${Object.keys(edges).length} potential edges`);
  
  // 3) Enrich nodes with additional data
  const nodeIds = dedupeIDs(seeds.map(s => s.key));
  const nodes = await enrichFunders(nodeIds, fromYear);
  
  // Set the count from seed data
  const seedCounts = new Map(seeds.map(s => [s.key, s.count]));
  nodes.forEach(node => {
    node.count = seedCounts.get(node.id) ?? 0;
  });
  
  // 4) Finalize edges
  const edgeArray: GraphEdge[] = Object.entries(edges)
    .map(([key, weight]) => {
      const [source, target] = key.split('|');
      return { source, target, weight };
    })
    .filter(edge => edge.weight >= minEdge);
  
  console.log(`Final graph: ${nodes.length} nodes, ${edgeArray.length} edges`);
  
  return {
    nodes,
    edges: edgeArray,
    meta: {
      fromYear,
      topicIds,
    },
  };
}

// Helper function to get current year for default calculations
export function getCurrentYear(): number {
  return new Date().getFullYear();
}

// Helper function to calculate from year based on years back
export function calculateFromYear(yearsBack: number = FUNDER_YEARS): number {
  return getCurrentYear() - (yearsBack - 1);
}
