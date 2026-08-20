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
    kpiDays: document.getElementById('kpi-days'),
    kpiLate: document.getElementById('kpi-late'),
    kpiOvertime: document.getElementById('kpi-overtime'),
    kpiHours: document.getElementById('kpi-hours'),
    kpiDiscount: document.getElementById('kpi-discount'),
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
    ,datePreset: document.getElementById('date-preset')
    ,userFilter: document.getElementById('user-filter')
    ,statusFilter: document.getElementById('status-filter')
    ,btnExport: document.getElementById('btn-export')
    ,employeeModal: document.getElementById('employee-modal')
    ,employeeModalTitle: document.getElementById('employee-modal-title')
    ,employeeModalSubtitle: document.getElementById('employee-modal-subtitle')
    ,employeeModalContent: document.getElementById('employee-modal-content')
    ,employeeModalClose: document.getElementById('employee-modal-close')
  };

  function renderSkeletons() {
    el.kpiToday.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiWeek.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiUsers.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiDays.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiLate.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiOvertime.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiHours.innerHTML = '<div class="skeleton h-10 w-16 rounded-lg"></div>';
    el.kpiDiscount.innerHTML = '<div class="skeleton h-10 w-20 rounded-lg"></div>';
    el.logsBody.innerHTML = Array.from({ length: 6 }).map(() => `
      <tr>
        <td class="px-4 py-3"><div class="skeleton h-6 w-32 rounded"></div></td>
        <td class="px-4 py-3"><div class="skeleton h-6 w-48 rounded"></div></td>
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

  function statusBadge(status) {
    const styles = {
      retardo: 'badge badge-warning',
      hora_extra: 'badge badge-success',
      salida_a_tiempo: 'badge badge-neutral',
      a_tiempo: 'badge badge-success'
    };
    const labels = {
      retardo: 'Retardo',
      hora_extra: 'Hora extra',
      salida_a_tiempo: 'Salida a tiempo',
      a_tiempo: 'A tiempo'
    };
    const key = labels[status] ? status : 'a_tiempo';
    return `<span class="${styles[key]}">${labels[key]}</span>`;
  }

  async function fetchLogs({ startIso = null, endIso = null, search = null, userId = null, status = null } = {}) {
    try {
      const params = new URLSearchParams();
      if (startIso) params.set('start', startIso);
      if (endIso) params.set('end', endIso);
      if (search) params.set('search', search);
      if (userId) params.set('user_id', userId);
      if (status) params.set('status', status);
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
        p_user_id: userId || null,
        p_status: status || null,
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
    (data || []).forEach((user) => {
      const option = document.createElement('option');
      option.value = user.id;
      option.textContent = user.nombre;
      el.userFilter.appendChild(option);
    });
    return data || [];
  }

  function getFilters() {
    return {
      startIso: el.dateStart.value ? dayjs(el.dateStart.value).startOf('day').toISOString() : null,
      endIso: el.dateEnd.value ? dayjs(el.dateEnd.value).endOf('day').toISOString() : null,
      search: el.searchName.value.trim() || null,
      userId: el.userFilter.value || null,
      status: el.statusFilter.value || null
    };
  }

  function downloadCsv() {
    const header = ['Fecha/Hora', 'Usuario', 'UUID', 'Tipo', 'Estado'];
    const rows = logsCache.map((log) => [log.timestamp, log.nombre, log.user_id, log.tipo_registro, log.attendance_status]);
    const csv = [header, ...rows].map((row) => row.map((value) => `"${String(value || '').replaceAll('"', '""')}"`).join(',')).join('\n');
    const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `asistencia-${dayjs().format('YYYY-MM-DD')}.csv`; link.click(); URL.revokeObjectURL(link.href);
  }

  function openEmployeeModal(log) {
    el.employeeModalTitle.textContent = log.nombre || 'Trabajador';
    el.employeeModalSubtitle.textContent = log.user_id || '';
    el.employeeModalContent.innerHTML = [['Registro', fmt(log.timestamp)], ['Tipo', log.tipo_registro || 'entrada'], ['Estado', log.attendance_status || 'a_tiempo'], ['Retardo', `${log.late_minutes || 0} min`], ['Hora extra', `${log.overtime_minutes || 0} min`], ['Descuento', `$${Number(log.discount_amount || 0).toFixed(2)}`]].map(([label, value]) => `<div class="rounded-xl border border-slate-800 bg-slate-950 p-3"><div class="text-xs uppercase text-slate-500">${label}</div><div class="mt-1 text-sm text-slate-100">${escapeHtml(value)}</div></div>`).join('');
    el.employeeModal.classList.remove('hidden'); el.employeeModal.classList.add('flex');
  }

  function renderTable() {
    const rows = logsCache || [];
    const defaultAvatar = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"%3E%3Crect width="64" height="64" rx="32" fill="%23e2e8f0"/%3E%3Ccircle cx="32" cy="25" r="11" fill="%2394a3b8"/%3E%3Cpath d="M13 55c2-12 11-18 19-18s17 6 19 18" fill="%2394a3b8"/%3E%3C/svg%3E';
    if (!rows.length) {
      el.logsBody.innerHTML = `
        <tr>
          <td colspan="4" class="px-4 py-6 text-center text-slate-400">Sin resultados</td>
        </tr>
      `;
    } else {
      el.logsBody.innerHTML = rows.map((log) => {
        const photoUrl = String(log.photo_url || '').trim() || defaultAvatar;
        const photo = `<img src="${escapeHtml(photoUrl)}" onerror="this.onerror=null;this.src='${defaultAvatar}'" class="w-8 h-8 rounded-full object-cover" alt="foto de ${escapeHtml(log.nombre || 'usuario')}" />`;

        return `
          <tr>
            <td class="px-4 py-3 align-middle whitespace-nowrap">${fmt(log.timestamp)}</td>
            <td class="px-4 py-3 align-middle">
              <div class="flex min-w-0 items-center gap-3">
                ${photo}
                <div class="min-w-0">
                  <div class="font-medium truncate">${escapeHtml(log.nombre || '')}</div>
                  <div class="max-w-[12rem] truncate text-xs text-slate-400" title="${escapeHtml(log.user_id || '')}">${escapeHtml(log.user_id || '')}</div>
                </div>
              </div>
            </td>
            <td class="px-4 py-3 align-middle whitespace-nowrap">
              <div class="text-xs uppercase tracking-wide text-slate-400">${escapeHtml(log.tipo_registro || 'entrada')}</div>
              ${statusBadge(log.attendance_status)}
            </td>
            <td class="px-4 py-3 align-middle whitespace-nowrap">
              <button data-id="${log.id}" class="view-employee px-3 py-1 bg-slate-700 rounded text-sm hover:bg-slate-600 transition">Ver</button>
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

      const startDate = el.dateStart.value || dayjs().startOf('month').format('YYYY-MM-DD');
      const endDate = el.dateEnd.value || dayjs().format('YYYY-MM-DD');
      const promises = [
        supabaseClient.from(config.attendanceTable).select('id, user_id, timestamp, device_info', { head: true, count: 'exact' }).gte('timestamp', todayStart).lte('timestamp', todayEnd),
        supabaseClient.from(config.attendanceTable).select('id, user_id, timestamp, device_info', { head: true, count: 'exact' }).gte('timestamp', weekStart),
        supabaseClient.from('users').select('id', { head: true, count: 'exact' }),
        supabaseClient.rpc('get_attendance_metrics', { p_start: startDate, p_end: endDate })
      ];

      const [todayResult, weekResult, usersResult, metricsResult] = await Promise.all(promises);
      [todayResult, weekResult, usersResult, metricsResult].forEach((result) => {
        if (result.error) console.error('Supabase attendance query error', result.error);
      });
      el.kpiToday.textContent = String(todayResult.count || 0);
      el.kpiWeek.textContent = String(weekResult.count || 0);
      el.kpiUsers.textContent = String(usersResult.count || 0);
      const metrics = metricsResult.data || {};
      el.kpiDays.textContent = String(metrics.days_worked || 0);
      el.kpiLate.textContent = `${metrics.late_minutes || 0} min`;
      el.kpiOvertime.textContent = `${metrics.overtime_minutes || 0} min`;
      el.kpiHours.textContent = `${((metrics.effective_minutes || 0) / 60).toFixed(1)} h`;
      el.kpiDiscount.textContent = `$${Number(metrics.discount_total || 0).toFixed(2)}`;
    } catch (error) {
      console.error('updateKPIs', error);
    }
  }

  async function applyFilters() {
    const start = el.dateStart.value ? dayjs(el.dateStart.value).startOf('day').toISOString() : null;
    const end = el.dateEnd.value ? dayjs(el.dateEnd.value).endOf('day').toISOString() : null;
    const search = el.searchName.value ? el.searchName.value.trim() : null;

    page = 0;
    await fetchLogs({ ...getFilters(), startIso: start, endIso: end, search });
    renderTable();
    await updateKPIs();
  }

  function resetFilters() {
    el.searchName.value = '';
    el.userFilter.value = '';
    el.statusFilter.value = '';
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
    el.dateStart.value = dayjs().startOf('month').format('YYYY-MM-DD');
    el.dateEnd.value = dayjs().format('YYYY-MM-DD');

    el.btnApply.addEventListener('click', applyFilters);
    el.btnReset.addEventListener('click', resetFilters);
    el.searchName.addEventListener('input', debounce(applyFilters, 400));
    el.userFilter.addEventListener('change', applyFilters);
    el.statusFilter.addEventListener('change', applyFilters);
    el.datePreset.addEventListener('change', () => {
      const now = dayjs(); const preset = el.datePreset.value;
      if (preset === 'today') { el.dateStart.value = now.format('YYYY-MM-DD'); el.dateEnd.value = now.format('YYYY-MM-DD'); }
      if (preset === 'week') { el.dateStart.value = now.startOf('week').format('YYYY-MM-DD'); el.dateEnd.value = now.format('YYYY-MM-DD'); }
      if (preset === 'month') { el.dateStart.value = now.startOf('month').format('YYYY-MM-DD'); el.dateEnd.value = now.format('YYYY-MM-DD'); }
      applyFilters();
    });
    el.btnExport.addEventListener('click', downloadCsv);
    el.logsBody.addEventListener('click', (event) => { const button = event.target.closest('.view-employee'); if (button) openEmployeeModal(logsCache.find((log) => log.id === button.dataset.id) || {}); });
    el.employeeModalClose.addEventListener('click', () => { el.employeeModal.classList.add('hidden'); el.employeeModal.classList.remove('flex'); });

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

