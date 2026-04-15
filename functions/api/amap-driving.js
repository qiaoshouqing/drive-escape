export async function onRequest(context) {
  const url = new URL(context.request.url);
  const origin = url.searchParams.get('origin');       // "lng,lat" (GCJ-02)
  const destinations = url.searchParams.get('destinations'); // "lng1,lat1|lng2,lat2|..." (GCJ-02)

  if (!origin || !destinations) {
    return new Response(JSON.stringify({ error: 'missing origin or destinations' }), { status: 400 });
  }

  const amapKey = context.env.AMAP_KEY;
  if (!amapKey) {
    return new Response(JSON.stringify({ error: 'AMAP_KEY not configured' }), { status: 500 });
  }

  // 高德距离测量 API: origins 和 destination 参数
  // origins: "lng1,lat1|lng2,lat2|..." 最多 100 个
  // destination: "lng,lat"
  // type=1: 驾车导航距离
  const amapUrl = `https://restapi.amap.com/v3/distance?origins=${encodeURIComponent(destinations)}&destination=${encodeURIComponent(origin)}&type=1&key=${amapKey}`;

  try {
    const r = await fetch(amapUrl);
    const data = await r.json();

    if (data.status !== '1' || !data.results) {
      return new Response(JSON.stringify({ durations: [], distances: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 高德返回 results 数组，每项有 origin_id, dest_id, distance(米), duration(秒)
    // 按 origin_id 排序保证顺序
    const sorted = data.results.slice().sort((a, b) => Number(a.origin_id) - Number(b.origin_id));
    const durations = sorted.map(r => Number(r.duration));
    const distances = sorted.map(r => Number(r.distance));

    return new Response(JSON.stringify({ durations, distances }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=300',
        'Access-Control-Allow-Origin': '*'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }
}
