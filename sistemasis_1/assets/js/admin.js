/* assets/js/admin.js
   Dashboard admin con datos de asistencia.
   Recomendado: usar window.ADMIN_ENDPOINT si existe; si no, fallback directo a Supabase.
*/
(function () {
  const config = {
    supabaseUrl: window.SUPABASE_URL || '',
    supabaseAnonKey: window.SUPABASE_ANON_KEY || '',
    adminEndpoint: window.ADMIN_ENDPOINT || '',
    attendanceTable: 'attendance_logs'
  };

  if (!config.supabaseUrl || !config.supabaseAnonKey) {
    console.warn('Configura window.SUPABASE_URL y window.SUPABASE_ANON_KEY para que el dashboard funcione.');
  }

  const supabaseClient = typeof window.supabase !== 'undefined' && typeof window.supabase.createClient === 'function'
    ? window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey)
    : null;

  const el = {
    kpiToday: document.getElementById('kpi-today'),
    kpiWeek: document.getElementById('kpi-week'),
    kpiUsers: document.getElementById('kpi-users'),
    logsBody: document.getElementById('logs-body'),
    searchName: document.getElementById('search-name'),
    dateStart: document.getElementById('date-start'),
    dateEnd: document.getElementById('date-end'),
    btnApply: document.getElementById('btn-apply'),
    btnReset: document.getElementById('btn-reset'),
    pageInfo: document.getElementById('page-info'),
    paginationPrev: document.getElementById('pagination-prev'),
    paginationNext: document.getElementById('pagination-next'),
    pageSize: document.getElementById('page-size')
  };

  function renderSkeletons() {
    el.kpiToday.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiWeek.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiUsers.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.logsBody.innerHTML = Array.from({ length: 6 }).map(() => `
      <tr>
        <td class="px-4 py-3"><div class="skeleton h-6 w-32 rounded"></div></td>
        <td class="px-4 py-3"><div class="skeleton h-6 w-48 rounded"></div></td>
        <td class="px-4 py-3"><div class="skeleton h-6 w-28 rounded"></div></td>
        <td class="px-4 py-3"><div class="skeleton h-6 w-20 rounded"></div></td>
        <td class="px-4 py-3"><div class="skeleton h-8 w-16 rounded"></div></td>
      </tr>
    `).join('');
  }

  let logsCache = [];
  let page = 0;
  let pageSize = 25;
  let totalRows = 0;

  function fmt(dt) {
    try {
      return dayjs(dt).format('YYYY-MM-DD HH:mm');
    } catch (error) {
      return dt;
    }
  }

  function escapeHtml(value) {
    if (!value) return '';
    return String(value)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;');
  }

  async function fetchLogs({ startIso = null, endIso = null, search = null } = {}) {
    try {
      const params = new URLSearchParams();
      if (startIso) params.set('start', startIso);
      if (endIso) params.set('end', endIso);
      if (search) params.set('search', search);
      params.set('limit', String(pageSize));
      params.set('offset', String(page * pageSize));

      if (config.adminEndpoint) {
        const url = new URL(config.adminEndpoint, window.location.href);
        for (const [key, value] of params.entries()) {
          url.searchParams.set(key, value);
        }

        const { data: sessionData } = await supabaseClient.auth.getSession();
        const accessToken = sessionData?.session?.access_token;
        if (!accessToken) {
          window.location.href = 'login.html';
          return [];
        }

        const response = await fetch(url.toString(), {
          method: 'GET',
          headers: { Authorization: `Bearer ${accessToken}` },
          credentials: 'omit'
        });
        if (!response.ok) {
          console.error('admin endpoint error', response.status);
          logsCache = [];
          totalRows = 0;
          return [];
        }

        const payload = await response.json();
        logsCache = payload.logs || [];
        totalRows = payload.total || 0;
        return logsCache;
      }

      if (!supabaseClient) {
        logsCache = [];
        totalRows = 0;
        return [];
      }

      const payload = await supabaseClient.rpc('get_attendance_logs', {
        p_start: startIso || null,
        p_end: endIso || null,
        p_search: search || null,
        p_limit: pageSize,
        p_offset: page * pageSize
      });

      const parsed = payload && payload.data ? payload.data : {};
      logsCache = parsed.logs || [];
      totalRows = parsed.total || 0;
      return logsCache;
    } catch (error) {
      console.error('fetchLogs', error);
      logsCache = [];
      totalRows = 0;
      return [];
    }
  }

  async function fetchUsers() {
    if (!supabaseClient) return;
    const { data, error } = await supabaseClient.from('users').select('id, nombre, photo_url');
    if (error) {
      console.error('fetchUsers', error);
      return;
    }
    return data || [];
  }

  function renderTable() {
    const rows = logsCache || [];
    if (!rows.length) {
      el.logsBody.innerHTML = `
        <tr>
          <td colspan="5" class="px-4 py-6 text-center text-slate-400">Sin resultados</td>
        </tr>
      `;
    } else {
      el.logsBody.innerHTML = rows.map((log) => {
        const photo = log.photo_url
          ? `<img src="${log.photo_url}" class="w-8 h-8 rounded-full object-cover" alt="foto" />`
          : `<div class="w-8 h-8 rounded-full bg-slate-700 flex items-center justify-center text-xs">U</div>`;

        return `
          <tr>
            <td class="px-4 py-3 align-top">${fmt(log.timestamp)}</td>
            <td class="px-4 py-3 align-top flex items-center gap-3">
              ${photo}
              <div>
                <div class="font-medium">${escapeHtml(log.nombre || '')}</div>
                <div class="text-slate-400 text-xs">${escapeHtml(log.user_id || '')}</div>
              </div>
            </td>
            <td class="px-4 py-3 align-top">${escapeHtml(log.device_info || '')}</td>
            <td class="px-4 py-3 align-top">${escapeHtml(log.tipo_registro || 'entrada')}</td>
            <td class="px-4 py-3 align-top">
              <button data-id="${log.id}" class="px-3 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600 transition">Ver</button>
            </td>
          </tr>
        `;
      }).join('');
    }

    const totalPages = Math.max(1, Math.ceil((totalRows || 0) / pageSize));
    el.pageInfo.textContent = `Página ${page + 1} de ${totalPages} — ${totalRows} registros`;
  }

  async function updateKPIs() {
    if (!supabaseClient) return;
    try {
      const todayStart = dayjs().startOf('day').toISOString();
      const todayEnd = dayjs().endOf('day').toISOString();
      const weekStart = dayjs().startOf('week').toISOString();

      const promises = [
        supabaseClient.from(config.attendanceTable).select('id, user_id, timestamp, device_info', { head: true, count: 'exact' }).gte('timestamp', todayStart).lte('timestamp', todayEnd),
        supabaseClient.from(config.attendanceTable).select('id, user_id, timestamp, device_info', { head: true, count: 'exact' }).gte('timestamp', weekStart),
        supabaseClient.from('users').select('id', { head: true, count: 'exact' })
      ];

      const [todayResult, weekResult, usersResult] = await Promise.all(promises);
      [todayResult, weekResult, usersResult].forEach((result) => {
        if (result.error) console.error('Supabase attendance query error', result.error);
      });
      el.kpiToday.textContent = String(todayResult.count || 0);
      el.kpiWeek.textContent = String(weekResult.count || 0);
      el.kpiUsers.textContent = String(usersResult.count || 0);
    } catch (error) {
      console.error('updateKPIs', error);
    }
  }

  async function applyFilters() {
    const start = el.dateStart.value ? dayjs(el.dateStart.value).startOf('day').toISOString() : null;
    const end = el.dateEnd.value ? dayjs(el.dateEnd.value).endOf('day').toISOString() : null;
    const search = el.searchName.value ? el.searchName.value.trim() : null;

    page = 0;
    await fetchLogs({ startIso: start, endIso: end, search });
    renderTable();
    await updateKPIs();
  }

  function resetFilters() {
    el.searchName.value = '';
    el.dateStart.value = '';
    el.dateEnd.value = '';
    page = 0;
    applyFilters();
  }

  function debounce(fn, wait = 300) {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), wait);
    };
  }

  async function init() {
    renderSkeletons();
    el.dateStart.value = dayjs().subtract(6, 'day').format('YYYY-MM-DD');
    el.dateEnd.value = dayjs().format('YYYY-MM-DD');

    el.btnApply.addEventListener('click', applyFilters);
    el.btnReset.addEventListener('click', resetFilters);
    el.searchName.addEventListener('input', debounce(applyFilters, 400));

    el.paginationPrev.addEventListener('click', async () => {
      if (page <= 0) return;
      page -= 1;
      await applyFilters();
    });

    el.paginationNext.addEventListener('click', async () => {
      const maxPage = Math.max(0, Math.ceil((totalRows || 0) / pageSize) - 1);
      if (page >= maxPage) return;
      page += 1;
      await applyFilters();
    });

    el.pageSize.addEventListener('change', async (event) => {
      pageSize = Number(event.target.value) || 25;
      page = 0;
      await applyFilters();
    });

    await fetchUsers();
    await applyFilters();
  }

  document.addEventListener('DOMContentLoaded', init);
})();

