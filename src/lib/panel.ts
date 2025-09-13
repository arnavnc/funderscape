export async function fetchFunderPanel(funderId: string, body: { topicIds?: string[]; fromYear?: number }) {
  const res = await fetch(`/api/funders/${encodeURIComponent(funderId)}/panel`, {
    method: 'POST', 
    headers: { 'content-type': 'application/json' }, 
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
