// OSRM 代理 + 缓存
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const coords = url.searchParams.get('coords'); // "lng1,lat1;lng2,lat2;..."
  const sources = url.searchParams.get('sources') || '0';
  const destinations = url.searchParams.get('destinations');

  if (!coords || !destinations) {
    return new Response(JSON.stringify({ error: 'missing coords or destinations' }), { status: 400 });
  }

  const cacheKey = `route:${coords}:${sources}:${destinations}`;
  const cache = context.env.DRIVE_ESCAPE_CACHE;

  // 尝试读缓存
  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=604800',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'HIT'
          }
        });
      }
    } catch (e) {}
  }

  const osrmUrl = `https://router.project-osrm.org/table/v1/driving/${coords}?sources=${sources}&destinations=${destinations}&annotations=duration,distance`;

  try {
    const r = await fetch(osrmUrl);
    const data = await r.json();

    if (data.code !== 'Ok') {
      return new Response(JSON.stringify({ durations: [], distances: [] }), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    const body = JSON.stringify({
      durations: data.durations,
      distances: data.distances
    });

    // 写入缓存（7天）
    if (cache) {
      try {
        await cache.put(cacheKey, body, { expirationTtl: 604800 });
      } catch (e) {}
    }

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=604800',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }
}
