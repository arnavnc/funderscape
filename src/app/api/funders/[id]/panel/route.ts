import { NextRequest } from 'next/server';

const BASE = process.env.OPENALEX_BASE ?? 'https://api.openalex.org';
const MAILTO = process.env.OPENALEX_MAILTO ?? 'arnav@gmail.com';
const YEARS = Number(process.env.PANEL_YEARS ?? 5);

function oa(path: string) {
  const u = new URL(BASE + path);
  if (MAILTO) u.searchParams.set('mailto', MAILTO);
  return u.toString();
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const resolvedParams = await params;
    console.log('Panel API called with params:', resolvedParams);
    const { topicIds = [], fromYear } = await req.json();
    console.log('Request body:', { topicIds, fromYear });
    const y = fromYear ?? (new Date().getFullYear() - (YEARS - 1));
    const topics = topicIds.length ? `topics.id:${topicIds.join('|')},` : '';
    console.log('Environment check:', { BASE, MAILTO, YEARS });

    // Use the full funder ID for API calls
    const funderId = resolvedParams.id.startsWith('https://') ? resolvedParams.id : `https://openalex.org/${resolvedParams.id}`;
    console.log('Using funder ID:', funderId);

    // 1) Funder profile
    const funderProfileId = resolvedParams.id.startsWith('https://') ? resolvedParams.id.split('/').pop() : resolvedParams.id;
    const funder = await fetch(oa(`/funders/${funderProfileId}?select=id,display_name,description,homepage_url,country_code,ids,image_thumbnail_url,roles,counts_by_year,summary_stats,works_count,grants_count`)).then(r=>r.json());

    // 2) Works in window (no topic filter)
    const windowGroups = await fetch(oa(`/works?filter=grants.funder:${funderId},publication_year:${y}-&group_by=grants.funder&per-page=200`)).then(r=>r.json());
    const worksInWindow = windowGroups.group_by?.find((g:any)=>g.key===funder.id)?.count ?? 0;

    // 3) Topic share (requires topicIds)
    let worksInTopic = 0, topicSharePct = 0;
    if (topicIds.length) {
      const all = await fetch(oa(`/works?filter=${topics}publication_year:${y}-&group_by=grants.funder&per-page=200&cursor=*`)).then(r=>r.json());
      const total = all.group_by?.reduce((a:number,g:any)=>a+g.count,0) ?? 0;
      worksInTopic = all.group_by?.find((g:any)=>g.key===funder.id)?.count ?? 0;
      topicSharePct = total ? (worksInTopic/total*100) : 0;
    }

    // 4) Co‑funders (within topic filter if provided)
    const neigh = await fetch(oa(`/works?filter=grants.funder:${funderId},${topics}publication_year:${y}-&group_by=grants.funder&per-page=200`)).then(r=>r.json());
    const cofunders = (neigh.group_by||[])
      .filter((g:any)=>g.key!==funder.id)
      .sort((a:any,b:any)=>b.count-a.count).slice(0,10)
      .map((g:any)=>({ id:g.key, name:g.key_display_name ?? g.key, count:g.count }));

    // 5) Topic mix, venues, geo (window only)
    const topicMix = await fetch(oa(`/works?filter=grants.funder:${funderId},publication_year:${y}-&group_by=topics.field.id&per-page=200`)).then(r=>r.json());
    const venues = await fetch(oa(`/works?filter=grants.funder:${funderId},publication_year:${y}-&group_by=primary_location.source.id&per-page=15`)).then(r=>r.json());
    const geo = await fetch(oa(`/works?filter=grants.funder:${funderId},publication_year:${y}-&group_by=authorships.institutions.country_code&per-page=200`)).then(r=>r.json());

    // 6) OA share
    const oaData = await fetch(oa(`/works?filter=grants.funder:${funderId},publication_year:${y}-&group_by=open_access.is_oa&per-page=2`)).then(r=>r.json());
    const oaTrue = oaData.group_by?.find((g:any)=>g.key===true)?.count ?? 0;
    const oaTotal = (oaData.group_by?.[0]?.count ?? 0) + (oaData.group_by?.[1]?.count ?? 0);
    const oaShare = oaTotal ? oaTrue/oaTotal : 0;

    // 7) Exemplars (evidence list)
    const exemplars = await fetch(oa(`/works?filter=grants.funder:${funderId},${topics}publication_year:${y}-&sort=cited_by_count:desc,publication_year:desc&per-page=5&select=id,display_name,publication_year,cited_by_count,open_access,best_oa_location,grants`)).then(r=>r.json());

    return Response.json({
      funder,
      kpis: { worksInWindow, worksInTopic, topicSharePct, oaShare },
      cofunders,
      topicMix: { groups: topicMix.group_by || [] },
      venues: { groups: venues.group_by || [] },
      geo: { groups: geo.group_by || [] },
      exemplars: exemplars.results || []
    });
  } catch (error) {
    console.error('Error in funder panel API:', error);
    console.error('Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : undefined
    });
    return Response.json({ 
      error: 'Failed to fetch funder panel data',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
