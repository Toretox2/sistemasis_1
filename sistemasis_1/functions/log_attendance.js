export async function onRequest(context) {
  const { request, env } = context

  // CORS: permitir preflight y orígenes configurables
  const origin = request.headers.get('Origin') || request.headers.get('origin')
  const allowed = (env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  const isAllowed = !allowed.length || (origin && allowed.includes(origin))

  if (request.method === 'OPTIONS') {
    const headers = {
      'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    }
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' }
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers })
  }

  let body
  try {
    body = await request.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { token, device_info } = body || {}
  if (!token || typeof token !== 'string' || token.length > 512) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  // Basic rate limiting using a bound KV (optional). Bind a KV namespace to env.RATE_LIMIT_KV.
  try {
    if (env.RATE_LIMIT_KV) {
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'anon'
      const windowKey = `rl:${ip}:${Math.floor(Date.now() / 60000)}`
      const current = await env.RATE_LIMIT_KV.get(windowKey)
      const limit = 30 // max requests per minute per IP
      if (current && Number.parseInt(current, 10) >= limit) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'Content-Type': 'application/json' } })
      }
      await env.RATE_LIMIT_KV.put(windowKey, (current ? String(Number.parseInt(current, 10) + 1) : '1'), { expirationTtl: 60 })
    }
  } catch (e) {
    // If KV not bound or error, continue without hard-failing
  }

  // Call Supabase RPC securely using service_role key from env
  const SUPABASE_URL = env.SUPABASE_URL
  const SERVICE_ROLE = env.SUPABASE_SERVICE_ROLE_KEY
  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: 'Server misconfigured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  try {
    const resp = await fetch(`${SUPABASE_URL}/rest/v1/rpc/log_attendance_by_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: SERVICE_ROLE,
        Authorization: `Bearer ${SERVICE_ROLE}`,
      },
      body: JSON.stringify({ p_token: token, p_device_info: device_info || '' })
    })

    const text = await resp.text()
    let payload = null
    try { payload = JSON.parse(text) } catch (e) { payload = { result: text } }
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' }
    return new Response(JSON.stringify(payload), { status: resp.status, headers })
  } catch (err) {
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' }
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers })
  }
}
