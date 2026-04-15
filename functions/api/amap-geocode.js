// GCJ-02 → WGS-84 转换（高德返回 GCJ-02，前端需要 WGS-84）
const PI = Math.PI;
const A = 6378245.0;
const EE = 0.00669342162296594;

function transformLat(x, y) {
  let ret = -100.0 + 2.0 * x + 3.0 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(y * PI) + 40.0 * Math.sin(y / 3.0 * PI)) * 2.0 / 3.0;
  ret += (160.0 * Math.sin(y / 12.0 * PI) + 320.0 * Math.sin(y * PI / 30.0)) * 2.0 / 3.0;
  return ret;
}

function transformLng(x, y) {
  let ret = 300.0 + x + 2.0 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * Math.sqrt(Math.abs(x));
  ret += (20.0 * Math.sin(6.0 * x * PI) + 20.0 * Math.sin(2.0 * x * PI)) * 2.0 / 3.0;
  ret += (20.0 * Math.sin(x * PI) + 40.0 * Math.sin(x / 3.0 * PI)) * 2.0 / 3.0;
  ret += (150.0 * Math.sin(x / 12.0 * PI) + 300.0 * Math.sin(x / 30.0 * PI)) * 2.0 / 3.0;
  return ret;
}

function gcj02ToWgs84(lng, lat) {
  if (lng < 72.004 || lng > 137.8347 || lat < 0.8293 || lat > 55.8271) return [lng, lat];
  let dLat = transformLat(lng - 105.0, lat - 35.0);
  let dLng = transformLng(lng - 105.0, lat - 35.0);
  const radLat = lat / 180.0 * PI;
  let magic = Math.sin(radLat);
  magic = 1 - EE * magic * magic;
  const sqrtMagic = Math.sqrt(magic);
  dLat = (dLat * 180.0) / ((A * (1 - EE)) / (magic * sqrtMagic) * PI);
  dLng = (dLng * 180.0) / (A / sqrtMagic * Math.cos(radLat) * PI);
  return [lng - dLng, lat - dLat];
}

export async function onRequest(context) {
  const url = new URL(context.request.url);
  const q = url.searchParams.get('q');
  const limit = url.searchParams.get('limit') || '5';

  if (!q) {
    return new Response(JSON.stringify({ error: 'missing q' }), { status: 400 });
  }

  const amapKey = context.env.AMAP_KEY;
  if (!amapKey) {
    return new Response(JSON.stringify({ error: 'AMAP_KEY not configured' }), { status: 500 });
  }

  const amapUrl = `https://restapi.amap.com/v3/place/text?keywords=${encodeURIComponent(q)}&city=&citylimit=false&output=json&offset=${limit}&key=${amapKey}`;

  try {
    const r = await fetch(amapUrl);
    const data = await r.json();

    if (data.status !== '1' || !data.pois || !data.pois.length) {
      return new Response(JSON.stringify([]), {
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
      });
    }

    // 转换为 Nominatim 兼容格式
    const results = data.pois.map(poi => {
      const [gLng, gLat] = poi.location.split(',').map(Number);
      const [wLng, wLat] = gcj02ToWgs84(gLng, gLat);

      // 构造 display_name：name, city, province
      const parts = [poi.name];
      if (poi.cityname) parts.push(poi.cityname);
      if (poi.pname && poi.pname !== poi.cityname) parts.push(poi.pname);
      const displayName = parts.join(', ');

      // 判断 country_code
      let countryCode = 'cn';
      if (poi.pname && /海外|国外/.test(poi.pname)) countryCode = '';

      return {
        display_name: displayName,
        lon: String(wLng),
        lat: String(wLat),
        address: { country_code: countryCode }
      };
    });

    return new Response(JSON.stringify(results), {
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
