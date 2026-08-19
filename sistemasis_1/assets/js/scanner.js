// Scanner UI logic using Html5QrcodeScanner and SweetAlert2 for toasts
const hasSupabaseConfig = typeof window.isSupabaseClientConfigValid === 'function'
  ? window.isSupabaseClientConfigValid()
  : Boolean(window.SUPABASE_URL && window.SUPABASE_ANON_KEY)
const supabaseClient = window.supabase && hasSupabaseConfig
  ? window.supabase.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY)
  : null

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
    if (!supabaseClient) {
      throw new Error('Supabase no está configurado. Revisa SUPABASE_URL y la anon public key.')
    }

    const { data: payload, error } = await supabaseClient.rpc('log_attendance_by_token', {
      p_token: decodedText,
      p_device_info: device_info
    })

    if (error) {
      setStatus('error')
      toastError('Error registrando: ' + error.message)
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
