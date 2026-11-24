const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
const checkinEl = document.getElementById('checkinInput');
if (checkinEl) checkinEl.value = tomorrowStr;
const bulkStartEl = document.getElementById('bulkStartDate');
if (bulkStartEl) bulkStartEl.value = tomorrowStr;

const defaultEndpoint = window.location.protocol.startsWith('http') ? '/api/live-rates' : '';
let apiEndpoint = localStorage.getItem('bpn_vercel_endpoint') || defaultEndpoint;

let currentView = 'DAILY';
let currentHotels = [];
let dateSnapshots = JSON.parse(localStorage.getItem('bpn_date_snapshots') || '{}');
let manualPlatinumRates = JSON.parse(localStorage.getItem('bpn_manual_platinum_rates') || '{}');
let inventoryMatrixStore = JSON.parse(localStorage.getItem('bpn_inventory_matrix') || '{}');
let directBookings = JSON.parse(localStorage.getItem('bpn_direct_bookings') || '[]');
let historyLogs = JSON.parse(localStorage.getItem('bpn_history_logs') || '[]');
let pollTimer = null;
let trendChartInstance = null;
let otaChartInstance = null;
let pickupChartInstance = null;

function toggleDescriptionPanel() {
  const box = document.getElementById('dashboardDescriptionBox');
  const txt = document.getElementById('descToggleText');
  if (!box || !txt) return;
  const willOpen = box.classList.contains('hidden');
  box.classList.toggle('hidden', !willOpen);
  txt.textContent = willOpen ? 'Close Description' : 'Description';
}

function formatNum(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return '-';
  return Math.round(n).toLocaleString('en-US');
}

function formatIDR(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return 'IDR 0';
  return 'IDR ' + Math.round(n).toLocaleString('en-US');
}

function formatTimeWITA(isoString) {
  const d = isoString ? new Date(isoString) : new Date();
  return d.toLocaleTimeString('en-GB', {
    timeZone: 'Asia/Makassar',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }) + ' WITA';
}

function addDays(dateStr, days) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().split('T')[0];
}

function syncManualInputDisplay(checkin) {
  const inp = document.getElementById('platinumManualInput');
  if (!inp) return;
  const saved = Number(manualPlatinumRates[checkin]) || 0;
  inp.value = saved > 0 ? saved : '';
}

function applyManualPlatinumRate() {
  const checkin = document.getElementById('checkinInput').value;
  const inp = document.getElementById('platinumManualInput');
  const val = Math.round(Number(inp?.value) || 0);
  if (val < 100000 || val > 5000000) return;

  manualPlatinumRates[checkin] = val;
  localStorage.setItem('bpn_manual_platinum_rates', JSON.stringify(manualPlatinumRates));

  if (currentHotels.length > 0) {
    currentHotels = normalizeZeroSoldOut(currentHotels, checkin);
    dateSnapshots[checkin] = currentHotels;
    localStorage.setItem('bpn_date_snapshots', JSON.stringify(dateSnapshots));
  }
  renderActiveView();
}

function clearManualPlatinumRate() {
  const checkin = document.getElementById('checkinInput').value;
  delete manualPlatinumRates[checkin];
  localStorage.setItem('bpn_manual_platinum_rates', JSON.stringify(manualPlatinumRates));
  syncManualInputDisplay(checkin);
  loadCachedSnapshot(checkin);
}

function findPreviousKnownHotelRate(hotelId, currentCheckin) {
  const MAX_ROOM = 3500000;
  const dates = Object.keys(dateSnapshots).sort().reverse();
  for (const d of dates) {
    if (d === currentCheckin) continue;
    const found = (dateSnapshots[d] || []).find((x) => {
      const r = Number(x.lowest_rate);
      return x.id === hotelId && r > 100000 && r <= MAX_ROOM;
    });
    if (found) return Number(found.lowest_rate);
  }
  return 0;
}

function normalizeZeroSoldOut(hotels, checkin) {
  const MAX_ROOM = 3500000;
  const manualOwn = Number(manualPlatinumRates[checkin]) || 0;

  const validRates = (hotels || [])
    .map((h) => Number(h.lowest_rate))
    .filter((n) => n > 100000 && n <= MAX_ROOM);

  const avgFallback = validRates.length > 0
    ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length / 5000) * 5000
    : 650000;

  return (hotels || []).map((h) => {
    let rate = Number(h.lowest_rate) || 0;
    let isEst = Boolean(h.is_estimated);
    let isManualOwn = false;

    if (h.isOwn && manualOwn > 0) {
      rate = manualOwn;
      isEst = false;
      isManualOwn = true;
    } else if (rate <= 100000 || rate > MAX_ROOM) {
      const prevRate = findPreviousKnownHotelRate(h.id, checkin);
      rate = (prevRate > 100000 && prevRate <= MAX_ROOM)
        ? prevRate
        : (Number(h.fallbackRate) || avgFallback);
      isEst = true;
    }

    const cleanOta = (val, mult) => {
      if (isManualOwn) return rate;
      const n = Number(val) || 0;
      if (n > 100000 && n <= MAX_ROOM && n <= rate * 1.6) return n;
      return Math.round((rate * mult) / 1000) * 1000;
    };

    const ota = h.ota_breakdown || {};
    const filteredAllOta = isManualOwn
      ? [{ source: 'Platinum Direct BAR', rate }]
      : Array.isArray(h.all_ota_rates)
        ? h.all_ota_rates.filter((x) => {
            const val = Number(x.rate);
            return val > 100000 && val <= MAX_ROOM && val <= rate * 1.6;
          })
        : [];

    return {
      ...h,
      status: 'AVAILABLE',
      is_estimated: isEst,
      is_manual_own: isManualOwn,
      lowest_rate: rate,
      all_ota_rates: filteredAllOta,
      ota_breakdown: {
        traveloka: cleanOta(ota.traveloka, 1.00),
        tiket: cleanOta(ota.tiket, 1.01),
        agoda: cleanOta(ota.agoda, 1.02),
        booking: cleanOta(ota.booking, 1.04)
      }
    };
  });
}

function getGroupFilteredHotels(hotels = currentHotels) {
  const grp = document.getElementById('groupFilterSelect')?.value || 'ALL';
  if (grp === 'ALL') return hotels;
  return hotels.filter((h) => h.isOwn || h.group === grp);
}

function setViewMode(mode) {
  currentView = mode;
  ['DAILY', 'INVENTORY', 'YIELD', 'DASHBOARD', 'GRID7', 'HISTORY'].forEach((m) => {
    const panel = document.getElementById('panel' + m);
    const btn = document.getElementById('view' + m);
    if (panel) panel.classList.toggle('hidden', m !== mode);
    if (btn) {
      btn.className = m === mode
        ? 'min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg font-bold bg-phb-blue text-white transition text-center touch-manipulation'
        : 'min-h-[36px] px-2.5 sm:px-3 py-1.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition text-center touch-manipulation';
    }
  });
  renderActiveView();
}

async function loadCachedSnapshot(targetDate = null) {
  const checkin = targetDate || document.getElementById('checkinInput').value;
  syncManualInputDisplay(checkin);
  const badge = document.getElementById('modeBadge');
  const badgeText = document.getElementById('modeBadgeText');

  if (Array.isArray(dateSnapshots[checkin]) && dateSnapshots[checkin].length > 0) {
    currentHotels = normalizeZeroSoldOut(dateSnapshots[checkin], checkin);
    if (badge) badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-full bg-sky-600 text-white shadow-sm mt-0.5';
    if (badgeText) badgeText.textContent = 'Supabase / Local Cache';
    renderActiveView();
  }

  if (!apiEndpoint) {
    renderActiveView();
    return;
  }

  try {
    const res = await fetch(`${apiEndpoint}?checkin=${encodeURIComponent(checkin)}&cached=1`);
    const data = await res.json();
    if (data && data.cached && Array.isArray(data.hotels) && data.hotels.length > 0) {
      const normalized = normalizeZeroSoldOut(data.hotels, checkin);
      dateSnapshots[checkin] = normalized;
      localStorage.setItem('bpn_date_snapshots', JSON.stringify(dateSnapshots));
      if (checkin === document.getElementById('checkinInput').value) {
        currentHotels = normalized;
        document.getElementById('lastUpdateText').textContent = formatTimeWITA(data.fetched_at);
        if (badge) badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-full bg-sky-600 text-white shadow-sm mt-0.5';
        if (badgeText) badgeText.textContent = 'Saved Snapshot';
      }
      renderActiveView();
    } else if (!dateSnapshots[checkin]) {
      currentHotels = [];
      if (badge) badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-full bg-slate-600 text-white shadow-sm mt-0.5';
      if (badgeText) badgeText.textContent = 'Ready (0 Quota)';
      renderActiveView();
    }
  } catch {
    renderActiveView();
  }
}

function handleDateChange() {
  const checkin = document.getElementById('checkinInput').value;
  const bulkStart = document.getElementById('bulkStartDate');
  if (bulkStart) bulkStart.value = checkin;
  loadCachedSnapshot(checkin);
}

async function fetchLiveRates(targetDate = null, silent = false) {
  const checkin = targetDate || document.getElementById('checkinInput').value;
  const icon = document.getElementById('spinIcon');
  const badge = document.getElementById('modeBadge');
  const badgeText = document.getElementById('modeBadgeText');
  const alertBanner = document.getElementById('alertBanner');

  if (!silent && icon) icon.classList.add('animate-spin');

  if (!apiEndpoint) {
    if (badge) badge.className = 'inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-full bg-amber-400 text-slate-900 shadow-sm mt-0.5';
    if (badgeText) badgeText.textContent = 'Offline Mode';
    if (!silent && icon) icon.classList.remove('animate-spin');
    renderActiveView();
    return null;
  }

  try {
    const res = await fetch(`${apiEndpoint}?checkin=${encodeURIComponent(checkin)}`);
    const text = await res.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      throw new Error(text.slice(0, 140) || 'Invalid JSON response from server');
    }
    if (!res.ok) throw new Error(data.error || 'Failed to fetch live
