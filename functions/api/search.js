// Nominatim 代理 + 缓存
export async function onRequest(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q');
  const limit = url.searchParams.get('limit') || '5';
  const lang = url.searchParams.get('lang') || 'zh';

  if (!q) {
    return new Response(JSON.stringify({ error: 'missing q' }), { status: 400 });
  }

  const cacheKey = `search:${lang}:${limit}:${q}`;
  const cache = context.env.DRIVE_ESCAPE_CACHE;

  // 尝试读缓存
  if (cache) {
    try {
      const cached = await cache.get(cacheKey);
      if (cached) {
        return new Response(cached, {
          headers: {
            'Content-Type': 'application/json',
            'Cache-Control': 'public, max-age=86400',
            'Access-Control-Allow-Origin': '*',
            'X-Cache': 'HIT'
          }
        });
      }
    } catch (e) {}
  }

  const acceptLang = lang === 'en' ? 'en' : lang === 'ja' ? 'ja' : 'zh';
  const nominatimUrl = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&addressdetails=1&limit=${limit}&accept-language=${acceptLang}`;

  try {
    const r = await fetch(nominatimUrl, {
      headers: { 'User-Agent': 'DriveEscape/1.0 (contact@drive-escape.com)' }
    });
    const data = await r.json();

    const results = Array.isArray(data) ? data.map(item => ({
      display_name: item.display_name,
      lon: String(item.lon),
      lat: String(item.lat),
      address: item.address || {}
    })) : [];

    const body = JSON.stringify(results);

    // 写入缓存（24小时）
    if (cache) {
      try {
        await cache.put(cacheKey, body, { expirationTtl: 86400 });
      } catch (e) {}
    }

    return new Response(body, {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=86400',
        'Access-Control-Allow-Origin': '*',
        'X-Cache': 'MISS'
      }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 502 });
  }
}
