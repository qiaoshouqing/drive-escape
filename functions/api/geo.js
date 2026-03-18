export async function onRequest(context) {
  const url = new URL(context.request.url);
  const code = url.searchParams.get('code');
  
  if (!code || !/^\d+$/.test(code)) {
    return new Response(JSON.stringify({ error: 'invalid code' }), { status: 400 });
  }
  
  const target = `https://geo.datav.aliyun.com/areas_v3/bound/${code}_full.json`;
  
  try {
    const r = await fetch(target, {
      headers: { 'Referer': 'https://datav.aliyun.com/', 'User-Agent': 'Mozilla/5.0' }
    });
    if (!r.ok) throw new Error(`${r.status}`);
    const data = await r.text();
    
    return new Response(data, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch(e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }
}
