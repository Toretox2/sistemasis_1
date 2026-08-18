addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

async function handleRequest(request) {
  // CORS support (configure ALLOWED_ORIGINS env var as comma-separated list)
  const origin = request.headers.get('Origin') || request.headers.get('origin')
  const allowed = (typeof ALLOWED_ORIGINS !== 'undefined' ? ALLOWED_ORIGINS : process.env.ALLOWED_ORIGINS || '').split(',').map(s => s.trim()).filter(Boolean)
  const isAllowed = !allowed.length || (origin && allowed.includes(origin))

  if (request.method === 'OPTIONS') {
    const headers = {
      'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
    return new Response(null, { status: 204, headers })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' } })
  }
  const SUPABASE_URL = typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : process.env.SUPABASE_URL
  const SERVICE_ROLE = typeof SUPABASE_SERVICE_ROLE_KEY !== 'undefined' ? SUPABASE_SERVICE_ROLE_KEY : process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!SUPABASE_URL || !SERVICE_ROLE) {
    return new Response(JSON.stringify({ error: 'Server not configured' }), { status: 500, headers: { 'Content-Type': 'application/json' } })
  }

  let body
  try {
    body = await request.json()
  } catch (e) {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  const { token, device_info } = body || {}
  if (!token || typeof token !== 'string' || token.length > 512) {
    return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400, headers: { 'Content-Type': 'application/json' } })
  }

  // Basic rate limiting attempt: if RATE_LIMIT_KV is bound on globalThis, use it
  try {
    if (globalThis.RATE_LIMIT_KV) {
      const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('x-forwarded-for') || 'anon'
      const windowKey = `rl:${ip}:${Math.floor(Date.now() / 60000)}`
      const current = await globalThis.RATE_LIMIT_KV.get(windowKey)
      const limit = 30
      if (current && parseInt(current) >= limit) {
        return new Response(JSON.stringify({ error: 'Rate limit exceeded' }), { status: 429, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' } })
      }
      await globalThis.RATE_LIMIT_KV.put(windowKey, (current ? String(parseInt(current) + 1) : '1'), { expirationTtl: 60 })
    }
  } catch (e) {
    // ignore KV errors
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
    const status = resp.status
    const headers = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' }
    return new Response(JSON.stringify(payload), { status, headers })
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null' } })
  }
}
