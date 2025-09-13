# Funder Panel — Quick Instructions (README)

A tiny, copy‑paste guide to implement the **left info panel** when a funder node is clicked in your OpenAlex map app. Focus: robust backend aggregator + simple, sleek frontend.

> This README excludes LLMs. It’s only the API calls, inputs/outputs, and UI wiring.

---

## 0) Prereqs
Create `.env.local`:
```dotenv
OPENALEX_BASE=https://api.openalex.org
OPENALEX_MAILTO=you@example.org  # required for the “polite pool”
PANEL_YEARS=5                    # default years window (e.g., 2021–2025)
```

**Conventions used below**
- `topicIds`: array of OpenAlex topic IDs like `T11636`. If omitted, the panel computes without topic narrowing (still limited by years).
- `fromYear`: integer lower bound (inclusive). Defaults to `currentYear - (PANEL_YEARS-1)`.

---

## 1) Backend aggregator route
Create `app/api/funders/[id]/panel/route.ts`.

### **Request** (POST JSON)
```json
{
  "topicIds": ["T11636", "T12419"],
  "fromYear": 2021
}
```
- `topicIds` optional; improves relevance and enables **topic share**.
- `fromYear` optional; if not provided, use env.

### **Response** (JSON shape)
```json
{
  "funder": {
    "id": "https://openalex.org/F4320332161",
    "display_name": "U.S. Department of Defense",
    "description": "...",
    "homepage_url": "https://...",
    "country_code": "US",
    "image_thumbnail_url": "https://...",
    "roles": [{"role":"funder"}],
    "ids": {"ror":"https://ror.org/...","doi":"https://doi.org/10.13039/...","wikidata":"https://www.wikidata.org/..."},
    "counts_by_year": [{"year":2025,"works_count":...}, ...],
    "summary_stats": {"2yr_mean_citedness":...,"h_index":...,"i10_index":...}
  },
  "kpis": {
    "worksInWindow": 22962,
    "worksInTopic": 5,
    "topicSharePct": 8.0,
    "oaShare": 0.41
  },
  "cofunders": [{"id":"https://openalex.org/F...","name":"NIH","count":73}],
  "topicMix": {"groups":[{"key":"T42","key_display_name":"Immunology","count":417}, ...]},
  "venues": {"groups":[{"key":"https://openalex.org/S...","key_display_name":"Nature Medicine","count":56}, ...]},
  "geo": {"groups":[{"key":"US","count":12398},{"key":"CN","count":611}]},
  "exemplars": [{
    "id":"https://openalex.org/W...",
    "display_name":"...",
    "publication_year":2024,
    "cited_by_count":125,
    "open_access":{"is_oa":true,"oa_status":"gold"},
    "best_oa_location":{"landing_page_url":"https://...","pdf_url":"https://..."},
    "grants":[{"award_id":"W81XWH-..."}]
  }]
}
```

### **Implementation (copy‑paste)**
```ts
// app/api/funders/[id]/panel/route.ts
import { NextRequest } from 'next/server';

const BASE = process.env.OPENALEX_BASE ?? 'https://api.openalex.org';
const MAILTO = process.env.OPENALEX_MAILTO ?? '';
const YEARS = Number(process.env.PANEL_YEARS ?? 5);

function oa(path: string) {
  const u = new URL(BASE + path);
  if (MAILTO) u.searchParams.set('mailto', MAILTO);
  return u.toString();
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const { topicIds = [], fromYear } = await req.json();
  const y = fromYear ?? (new Date().getFullYear() - (YEARS - 1));
  const topics = topicIds.length ? `topics.id:${topicIds.join('|')},` : '';

  // 1) Funder profile
  const funder = await fetch(oa(`/funders/${params.id}?select=id,display_name,description,homepage_url,country_code,ids,image_thumbnail_url,roles,counts_by_year,summary_stats,works_count,grants_count`)).then(r=>r.json());

  // 2) Works in window (no topic filter)
  const windowGroups = await fetch(oa(`/works?filter=grants.funder:${params.id},publication_year:>=${y}&group_by=grants.funder&per-page=200`)).then(r=>r.json());
  const worksInWindow = windowGroups.groups?.find((g:any)=>g.key===funder.id)?.count ?? 0;

  // 3) Topic share (requires topicIds)
  let worksInTopic = 0, topicSharePct = 0;
  if (topicIds.length) {
    const all = await fetch(oa(`/works?filter=${topics}publication_year:>=${y}&group_by=grants.funder&per-page=200&cursor=*`)).then(r=>r.json());
    const total = all.groups?.reduce((a:number,g:any)=>a+g.count,0) ?? 0;
    worksInTopic = all.groups?.find((g:any)=>g.key===funder.id)?.count ?? 0;
    topicSharePct = total ? (worksInTopic/total*100) : 0;
  }

  // 4) Co‑funders (within topic filter if provided)
  const neigh = await fetch(oa(`/works?filter=grants.funder:${params.id},${topics}publication_year:>=${y}&group_by=grants.funder&per-page=200`)).then(r=>r.json());
  const cofunders = (neigh.groups||[])\
    .filter((g:any)=>g.key!==funder.id)\
    .sort((a:any,b:any)=>b.count-a.count).slice(0,10)\
    .map((g:any)=>({ id:g.key, name:g.key_display_name ?? g.key, count:g.count }));

  // 5) Topic mix, venues, geo (window only)
  const topicMix = await fetch(oa(`/works?filter=grants.funder:${params.id},publication_year:>=${y}&group_by=topics.field.id&per-page=200`)).then(r=>r.json());
  const venues = await fetch(oa(`/works?filter=grants.funder:${params.id},publication_year:>=${y}&group_by=primary_location.source.id&per-page=15`)).then(r=>r.json());
  const geo = await fetch(oa(`/works?filter=grants.funder:${params.id},publication_year:>=${y}&group_by=authorships.institutions.country_code&per-page=200`)).then(r=>r.json());

  // 6) OA share
  const oa = await fetch(oa(`/works?filter=grants.funder:${params.id},publication_year:>=${y}&group_by=open_access.is_oa&per-page=2`)).then(r=>r.json());
  const oaTrue = oa.groups?.find((g:any)=>g.key===true)?.count ?? 0;
  const oaTotal = (oa.groups?.[0]?.count ?? 0) + (oa.groups?.[1]?.count ?? 0);
  const oaShare = oaTotal ? oaTrue/oaTotal : 0;

  // 7) Exemplars (evidence list)
  const exemplars = await fetch(oa(`/works?filter=grants.funder:${params.id},${topics}publication_year:>=${y}&sort=cited_by_count:desc,publication_year:desc&per-page=5&select=id,display_name,publication_year,cited_by_count,open_access,best_oa_location,grants`)).then(r=>r.json());

  return Response.json({
    funder,
    kpis: { worksInWindow, worksInTopic, topicSharePct, oaShare },
    cofunders,
    topicMix,
    venues,
    geo,
    exemplars: exemplars.results || []
  });
}
```

**Notes**
- Always append `mailto` (handled in `oa()` helper).
- `select=` is used on entity/works list calls (not supported on `group_by`).
- Add minimal retries/backoff for 429/5xx in production.

---

## 2) Frontend wiring (simple & sleek)

### **Fetcher**
```ts
// lib/panel.ts
export async function fetchFunderPanel(funderId: string, body: { topicIds?: string[]; fromYear?: number }) {
  const res = await fetch(`/api/funders/${encodeURIComponent(funderId)}/panel`, {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
```

### **Panel component skeleton**
Use Tailwind + micro‑charts (optional).
```tsx
// components/FunderPanel.tsx
export default function FunderPanel({ data, onClose }: { data: any; onClose?: () => void }) {
  const f = data.funder; const k = data.kpis;
  return (
    <aside className="w-[360px] shrink-0 border-r bg-white/80 backdrop-blur p-4 space-y-4">
      <header className="flex items-start gap-3">
        {f.image_thumbnail_url && <img src={f.image_thumbnail_url} className="h-10 w-10 rounded object-contain" alt=""/>}
        <div className="min-w-0"><div className="text-lg font-semibold">{f.display_name}</div>
          <div className="mt-1 flex flex-wrap gap-1 text-xs text-slate-600">
            {f.country_code && <span className="px-2 py-0.5 rounded-full bg-slate-100">{f.country_code}</span>}
            {(f.roles||[]).map((r:any)=> <span key={r.role} className="px-2 py-0.5 rounded-full bg-slate-100">{r.role}</span>)}
          </div>
        </div>
      </header>

      <section className="grid grid-cols-3 gap-3 rounded-2xl border p-3">
        <div><div className="text-[11px] text-slate-500">Works (window)</div><div className="text-xl font-semibold">{k.worksInWindow.toLocaleString()}</div></div>
        <div><div className="text-[11px] text-slate-500">Works in topic</div><div className="text-xl font-semibold">{k.worksInTopic?.toLocaleString?.() ?? '—'}</div></div>
        <div><div className="text-[11px] text-slate-500">OA share</div><div className="text-xl font-semibold">{Math.round(k.oaShare*100)}%</div></div>
        <div className="col-span-3 text-[11px] text-slate-500">Topic share: {k.topicSharePct ? k.topicSharePct.toFixed(1) + '%' : '—'}</div>
      </section>

      <section>
        <div className="text-xs font-medium text-slate-500 mb-2">Top co‑funders</div>
        <div className="flex flex-wrap gap-1">
          {data.cofunders?.length ? data.cofunders.map((c:any)=> (
            <span key={c.id} className="px-2 py-1 rounded-full bg-slate-100 text-xs">{c.name} · {c.count}</span>
          )) : <div className="text-xs text-slate-400">No co‑funder relationships found</div>}
        </div>
      </section>

      <section>
        <div className="text-xs font-medium text-slate-500 mb-2">Research focus</div>
        <ul className="space-y-1">
          {data.topicMix.groups?.slice(0,5).map((g:any)=> (
            <li key={g.key} className="flex items-center justify-between text-sm">
              <span className="truncate">{g.key_display_name || g.key}</span>
              <span className="tabular-nums text-slate-500">{g.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="text-xs font-medium text-slate-500 mb-2">Top sources</div>
        <ul className="space-y-1">
          {data.venues.groups?.slice(0,6).map((g:any)=> (
            <li key={g.key} className="flex items-center justify-between text-sm">
              <span className="truncate">{g.key_display_name || g.key}</span>
              <span className="tabular-nums text-slate-500">{g.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="text-xs font-medium text-slate-500 mb-2">Geographic reach</div>
        <ul className="space-y-1">
          {data.geo.groups?.slice(0,5).map((g:any)=> (
            <li key={g.key} className="flex items-center justify-between text-sm">
              <span className="truncate">{g.key || '—'}</span>
              <span className="tabular-nums text-slate-500">{g.count}</span>
            </li>
          ))}
        </ul>
      </section>

      <section>
        <div className="text-xs font-medium text-slate-500 mb-2">Example works</div>
        <ul className="space-y-2">
          {data.exemplars.map((w:any)=> (
            <li key={w.id} className="text-sm leading-tight">
              <a className="underline" href={w.id} target="_blank" rel="noreferrer">{w.display_name}</a>
              <div className="text-xs text-slate-500">{w.publication_year} · cites {w.cited_by_count ?? 0}{w.open_access?.is_oa ? ' · OA' : ''}</div>
            </li>
          ))}
        </ul>
      </section>
    </aside>
  );
}
```

### **How to load**
When a graph node is clicked:
```ts
// somewhere in your graph view
const data = await fetchFunderPanel(funderId, { topicIds: selectedTopicIds, fromYear });
setSelectedPanelData(data);
```

---

## 3) Exact OpenAlex calls used (for reference/testing)

**Funder profile**
```
GET /funders/{FID}?select=id,display_name,description,homepage_url,country_code,ids,image_thumbnail_url,roles,counts_by_year,summary_stats,works_count,grants_count&mailto=...
```

**Works by this funder (window only, count)**
```
GET /works?filter=grants.funder:{FID},publication_year:>={YYYY}&group_by=grants.funder&per-page=200&mailto=...
```

**Topic share (requires topics)**
```
GET /works?filter=topics.id:T1|T2,publication_year:>={YYYY}&group_by=grants.funder&per-page=200&cursor=*&mailto=...
```

**Co‑funders (within topic filter if provided)**
```
GET /works?filter=grants.funder:{FID},topics.id:T1|T2,publication_year:>={YYYY}&group_by=grants.funder&per-page=200&mailto=...
```

**Topic mix**
```
GET /works?filter=grants.funder:{FID},publication_year:>={YYYY}&group_by=topics.field.id&per-page=200&mailto=...
```

**Venues**
```
GET /works?filter=grants.funder:{FID},publication_year:>={YYYY}&group_by=primary_location.source.id&per-page=15&mailto=...
```

**Geography**
```
GET /works?filter=grants.funder:{FID},publication_year:>={YYYY}&group_by=authorships.institutions.country_code&per-page=200&mailto=...
```

**Open‑access share**
```
GET /works?filter=grants.funder:{FID},publication_year:>={YYYY}&group_by=open_access.is_oa&per-page=2&mailto=...
```

**Exemplars**
```
GET /works?filter=grants.funder:{FID},topics.id:T1|T2,publication_year:>={YYYY}&sort=cited_by_count:desc,publication_year:desc&per-page=5&select=id,display_name,publication_year,cited_by_count,open_access,best_oa_location,grants&mailto=...
```

---

## 4) UX notes (keep it sleek)
- Use **chips** for roles/country; **micro‑KPIs** with subtle labels; **line‑sparkline** from `counts_by_year`.
- Add tooltips with the exact filters used (great for transparency).
- If co‑funders are empty, show: “No co‑funder relationships found (grant tags may be incomplete).”
- Handle `key_display_name` fallbacks to `key`.

That’s it — drop this in and your panel will be both informative and clean.