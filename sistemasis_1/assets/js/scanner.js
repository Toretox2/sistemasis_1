// Scanner UI logic using Html5QrcodeScanner and SweetAlert2 for toasts
const LOG_ENDPOINT = window.LOG_ENDPOINT || '/api/log_attendance'

const startBtn = document.getElementById('startBtn')
const stopBtn = document.getElementById('stopBtn')
const statusEl = document.getElementById('status')
const messageEl = document.getElementById('message')
const readerElId = 'reader'

let html5QrcodeScanner = null
let lastScan = 0

function setStatus(text) {
  statusEl.textContent = 'Estado: ' + text
}

function toastSuccess(title) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'success',
    title,
    showConfirmButton: false,
    timer: 2000,
    timerProgressBar: true,
    background: '#041527',
    color: '#cfeeff'
  })
}

function toastError(title) {
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon: 'error',
    title,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
    background: '#2b0f11',
    color: '#ffdede'
  })
}

function getBackendError(response, payload, text) {
  if (response.status === 500 && /misconfigured/i.test(payload?.error || text || '')) {
    return 'El backend no está configurado. Define SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY en Cloudflare.'
  }
  return payload?.error || text || `HTTP ${response.status}`
}

function createScanner() {
  if (html5QrcodeScanner) return

  if (!window.Html5QrcodeScanner) {
    setStatus('Scanner no disponible')
    toastError('Librería de escaneo no cargada')
    return
  }

  const config = {
    fps: 10,
    qrbox: 300,
    rememberLastUsedCamera: true,
    // try to prefer environment facing camera
    videoConstraints: {
      facingMode: { ideal: 'environment' }
    }
  }

  html5QrcodeScanner = new window.Html5QrcodeScanner(readerElId, config, false)
  html5QrcodeScanner.render(onScanSuccess, onScanError)
  setStatus('buscando QR...')
}

async function onScanSuccess(decodedText, decodedResult) {
  const now = Date.now()
  if (now - lastScan < 2000) return
  lastScan = now

  setStatus('token detectado')
  const timestamp = new Date().toISOString()
  const device_info = navigator.userAgent

  // stop scanner UI while processing
  try {
    if (html5QrcodeScanner) {
      await html5QrcodeScanner.clear()
      html5QrcodeScanner = null
    }
  } catch (e) {
    console.warn('Error clearing scanner:', e)
  }

  try {
    if (!LOG_ENDPOINT || !/^https?:\/\//.test(LOG_ENDPOINT) && !LOG_ENDPOINT.startsWith('/')) {
      throw new Error('LOG_ENDPOINT no está configurado correctamente')
    }

    const res = await fetch(LOG_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: decodedText, device_info, timestamp })
    })

    const text = await res.text()
    let payload = null
    try { payload = JSON.parse(text) } catch (e) { payload = { result: text } }
    if (!res.ok) {
      setStatus('error')
      toastError(getBackendError(res, payload, text))
    } else {
      setStatus('registrado')
      // If server returned user name, show a richer modal
      if (payload && payload.nombre) {
        const serverTime = payload.created_at ? new Date(payload.created_at).toLocaleString() : new Date(timestamp).toLocaleString()
        const photoHtml = payload.photo_url ? `<img src="${payload.photo_url}" alt="foto" class="mx-auto rounded-full w-20 h-20 mb-3 object-cover"/>` : ''
        Swal.fire({
          title: 'Asistencia confirmada',
          html: `<div class="text-center">${photoHtml}<div class="text-left"><strong>Nombre:</strong> ${payload.nombre}<br/><strong>Hora:</strong> ${serverTime}</div></div>`,
          icon: 'success',
          background: '#041527',
          color: '#cfeeff',
          timer: 2800,
          showConfirmButton: false,
          toast: false,
        })
      } else {
        toastSuccess('Asistencia registrada')
      }
    }
  } catch (err) {
    setStatus('error red')
    toastError('Error de red: ' + err.message)
  }

  // recreate scanner after short delay
  setTimeout(() => {
    createScanner()
  }, 1200)
}

function onScanError(errorMessage) {
  // ignore frequent scan errors; optionally log
}

startBtn.addEventListener('click', () => {
  if (!html5QrcodeScanner) createScanner()
})

stopBtn.addEventListener('click', async () => {
  if (html5QrcodeScanner) {
    try {
      await html5QrcodeScanner.clear()
      html5QrcodeScanner = null
      setStatus('detenido')
    } catch (e) {
      console.warn('Error stopping scanner', e)
    }
  }
})

function initializeScanner() {
  if (!document.getElementById(readerElId)) return
  createScanner()
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeScanner, { once: true })
} else {
  initializeScanner()
}
