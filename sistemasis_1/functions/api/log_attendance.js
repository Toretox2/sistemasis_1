export async function onRequest(context) {
  const { request, env } = context
  const origin = request.headers.get('Origin') || ''
  const allowedOrigins = (env.ALLOWED_ORIGINS || '').split(',').map((value) => value.trim()).filter(Boolean)
  const isAllowed = !allowedOrigins.length || allowedOrigins.includes(origin)
  const corsOrigin = isAllowed ? origin || '*' : 'null'
  const baseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': corsOrigin,
    'Vary': 'Origin'
  }

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        ...baseHeaders,
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type'
      }
    })
  }

  if (!isAllowed) {
    return new Response(JSON.stringify({ error: 'Origin not allowed' }), { status: 403, headers: baseHeaders })
  }

  if (request.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405, headers: baseHeaders })
  }

  let body
  try {
    body = await request.json()
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: baseHeaders })
  }

  const { token, device_info } = body || {}
  if (!token || typeof token !== 'string' || token.length > 512) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { status: 400, headers: baseHeaders })
  }

  const supabaseUrl = env.SUPABASE_URL
  const serviceRole = env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !/^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(supabaseUrl)) {
    return new Response(JSON.stringify({ error: 'Backend sin configurar: SUPABASE_URL falta o no es válida.' }), { status: 500, headers: baseHeaders })
  }
  if (!serviceRole) {
    return new Response(JSON.stringify({ error: 'Backend sin configurar: falta SUPABASE_SERVICE_ROLE_KEY en Cloudflare.' }), { status: 500, headers: baseHeaders })
  }

  try {
    const response = await fetch(`${supabaseUrl.replace(/\/$/, '')}/rest/v1/rpc/log_attendance_by_token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        apikey: serviceRole,
        Authorization: `Bearer ${serviceRole}`
      },
      body: JSON.stringify({ p_token: token, p_device_info: device_info || '' })
    })

    const text = await response.text()
    let payload
    try {
      payload = text ? JSON.parse(text) : {}
    } catch {
      payload = { result: text }
    }

    return new Response(JSON.stringify(payload), {
      status: response.status,
      headers: baseHeaders
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: baseHeaders })
  }
}
