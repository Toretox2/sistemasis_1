// Configuración cliente para entorno local/producción.
// Recomendado: configurar el endpoint del Worker para la parte admin.
(function () {
  window.LOG_ENDPOINT = window.LOG_ENDPOINT || '/api/log_attendance';
  window.ADMIN_ENDPOINT = window.ADMIN_ENDPOINT || '';
  window.SUPABASE_URL = window.SUPABASE_URL || 'https://bkgnoksrwesofqyxhohk.supabase.co';
  window.SUPABASE_ANON_KEY = window.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJrZ25va3Nyd2Vzb2ZxeXhob2hrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcwODUwMTcsImV4cCI6MjEwMjY2MTAxN30.j9emABvFOm6PdPjNHT73BS1cxa2-u3jShQxoI7OcMDc';

  window.isSupabaseClientConfigValid = function () {
    const url = window.SUPABASE_URL;
    const anonKey = window.SUPABASE_ANON_KEY;
    return typeof url === 'string'
      && /^https:\/\/[^\s/]+\.supabase\.co\/?$/.test(url)
      && typeof anonKey === 'string'
      && anonKey.length > 40
      && anonKey.split('.').length === 3;
  };
})();
