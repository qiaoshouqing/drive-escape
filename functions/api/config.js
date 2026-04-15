export async function onRequest(context) {
  return new Response(JSON.stringify({
    useAmap: context.env.USE_AMAP === 'true'
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'public, max-age=300',
      'Access-Control-Allow-Origin': '*'
    }
  });
}
