addEventListener('fetch', event => {
  event.respondWith(handleRequest(event.request))
})

const jsonResponse = (body, status=200, origin='*') => {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json;charset=UTF-8',
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    }
  })
}

async function handleOptions(request){
  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = (typeof ALLOWED_ORIGINS !== 'undefined' ? ALLOWED_ORIGINS : '')
    .split(',').map(s => s.trim()).filter(Boolean)
  const isAllowed = !allowedOrigins.length || allowedOrigins.includes(origin)
  return new Response(null, { status: 204, headers: {
    'Access-Control-Allow-Origin': isAllowed ? origin || '*' : 'null',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  }})
}

async function handleRequest(request){
  if (request.method === 'OPTIONS') return handleOptions(request)

  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = (typeof ALLOWED_ORIGINS !== 'undefined' ? ALLOWED_ORIGINS : '')
    .split(',').map(s => s.trim()).filter(Boolean)
  if (allowedOrigins.length > 0 && !allowedOrigins.includes(origin)) {
    return jsonResponse({ error: 'Origin not allowed' }, 403, 'null')
  }

  const authorization = request.headers.get('Authorization') || ''
  if (!authorization.startsWith('Bearer ')) {
    return jsonResponse({ error: 'Authentication required' }, 401, origin || '*')
  }

  // parse params from GET query or POST body
  const url = new URL(request.url)
  const params = url.searchParams
  let body = {}
  if (request.method === 'POST') {
    try { body = await request.json() } catch(e) { body = {} }
  }

  const p_start = params.get('start') || body.p_start || null
  const p_end = params.get('end') || body.p_end || null
  const p_search = params.get('search') || body.p_search || null
  const p_limit = params.get('limit') || body.p_limit || 50
  const p_offset = params.get('offset') || body.p_offset || 0

  // call Supabase RPC using service role
  const supabaseUrl = (typeof SUPABASE_URL !== 'undefined' ? SUPABASE_URL : 'https://bkgnoksrwesofqyxhohk.supabase.co').trim()
  const serviceRole = (typeof SUPABASE_SERVICE_ROLE_KEY !== 'undefined' ? SUPABASE_SERVICE_ROLE_KEY : '').trim()
  if (!supabaseUrl || !serviceRole) return jsonResponse({ error: 'Server not configured' }, 500)

  const authResponse = await fetch(`${supabaseUrl.replace(/\/$/, '')}/auth/v1/user`, {
    headers: {
      apikey: serviceRole,
      Authorization: authorization
    }
  })
  if (!authResponse.ok) {
    return jsonResponse({ error: 'Invalid or expired session' }, 401, origin || '*')
  }

  const rpcUrl = `${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/get_attendance_logs`
  const rpcBody = { p_start, p_end, p_search, p_limit: Number.parseInt(p_limit, 10), p_offset: Number.parseInt(p_offset, 10) }

  try {
    const resp = await fetch(rpcUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': serviceRole,
        'Authorization': `Bearer ${serviceRole}`
      },
      body: JSON.stringify(rpcBody)
    })
    const text = await resp.text()
    // Supabase may return JSON text; ensure it's JSON
    const parsed = text ? JSON.parse(text) : {}
    return jsonResponse(parsed, resp.status, origin || '*')
  } catch (e) {
    return jsonResponse({ error: e.message }, 500, origin || '*')
  }
}
