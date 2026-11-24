(() => {
  'use strict';

  // Bersihkan sisa override manual lama agar Platinum murni mengikuti feed OTA
  localStorage.removeItem('bpn_manual_platinum_rates');

  const defaultTrackedHotels = [
    { id: 'platinum', group: 'CORE', fallbackRate: 850000, name: 'Platinum Hotel & Convention Hall Balikpapan', area: 'Jl. Soekarno Hatta, Balikpapan', isOwn: true },
    { id: 'bluesky', group: 'CORE', fallbackRate: 780000, name: 'Blue Sky Hotel Balikpapan', area: 'Kebun Sayur, Balikpapan', isOwn: false },
    { id: 'swissbel_balcony', group: 'CORE', fallbackRate: 810000, name: 'Swiss-Belhotel Balikpapan', area: 'Balikpapan Ocean Square (BOS)', isOwn: false },
    { id: 'novotel', group: 'CORE', fallbackRate: 1150000, name: 'Novotel Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
    { id: 'grand_jatra', group: 'CORE', fallbackRate: 1050000, name: 'Grand Jatra Hotel Balikpapan', area: 'e-Walk / Balikpapan SuperBlock', isOwn: false },
    { id: 'grand_tjokro', group: 'CORE', fallbackRate: 540000, name: 'Grand Tjokro Balikpapan', area: 'Jl. Marsma R. Iswahyudi', isOwn: false },
    { id: 'astara', group: 'CORE', fallbackRate: 920000, name: 'Astara Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'gran_senyiur', group: 'EXTENDED', fallbackRate: 670000, name: 'Gran Senyiur Balikpapan', area: 'Jl. ARS Moh. No. 1-7', isOwn: false },
    { id: 'horison_ultima', group: 'EXTENDED', fallbackRate: 470000, name: 'Horison Ultima Benua Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'penta_city', group: 'EXTENDED', fallbackRate: 560000, name: 'Penta City Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'golden_tulip', group: 'EXTENDED', fallbackRate: 850000, name: 'Golden Tulip Balikpapan Hotel & Suites', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'dprima', group: 'EXTENDED', fallbackRate: 430000, name: "D'Prima Hotel Balikpapan", area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'pacific', group: 'EXTENDED', fallbackRate: 350000, name: 'Pacific Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'sagita', group: 'EXTENDED', fallbackRate: 420000, name: 'Sagita Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'ibis', group: 'EXTENDED', fallbackRate: 510000, name: 'ibis Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
    { id: 'quest', group: 'EXTENDED', fallbackRate: 460000, name: 'Quest Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'neo_plus', group: 'EXTENDED', fallbackRate: 440000, name: 'Hotel NEO+ Balikpapan', area: 'Jl. Podomoro / MT Haryono', isOwn: false },
    { id: 'zurich', group: 'EXTENDED', fallbackRate: 410000, name: 'Zurich Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'swissbel_inn', group: 'EXTENDED', fallbackRate: 530000, name: 'Swiss-Belinn Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'max_one', group: 'EXTENDED', fallbackRate: 390000, name: 'MaxOneHotels at Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'whiz', group: 'EXTENDED', fallbackRate: 360000, name: 'Whiz Prime Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false }
  ];

  const MAX_STANDARD_ROOM_RATE = 3500000;
  const tomorrowStr = new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const apiEndpoint = window.location.protocol.startsWith('http') ? '/api/live-rates' : '';

  let currentView = 'DAILY';
  let currentHotels = [];
  let dateSnapshots = safeJsonParse(localStorage.getItem('bpn_date_snapshots'), {});
  let historyLogs = safeJsonParse(localStorage.getItem('bpn_history_logs'), []);
  let pollTimer = null;
  let trendChartInstance = null;
  let otaChartInstance = null;

  function safeJsonParse(raw, fallback) {
    try {
      const parsed = JSON.parse(raw);
      return parsed ?? fallback;
    } catch {
      return fallback;
    }
  }

  function getActiveCheckin() {
    const el = document.getElementById('checkinInput');
    if (el && !el.value) el.value = tomorrowStr;
    return el ? el.value : tomorrowStr;
  }

  function setBadge(stateClass, text) {
    const badge = document.getElementById('modeBadge');
    const badgeText = document.getElementById('modeBadgeText');
    if (badge) badge.className = `inline-flex items-center gap-1 px-2 py-0.5 text-[10px] sm:text-[11px] font-semibold rounded-full shadow-sm mt-0.5 ${stateClass}`;
    if (badgeText) badgeText.textContent = text;
  }

  function showAlert(type, htmlMessage) {
    const banner = document.getElementById('alertBanner');
    if (!banner) return;
    if (!htmlMessage) {
      banner.classList.add('hidden');
      banner.innerHTML = '';
      return;
    }
    const styles = type === 'error'
      ? 'bg-rose-50 border-rose-200 text-rose-800'
      : 'bg-sky-50 border-sky-200 text-sky-900';
    const iconName = type === 'error' ? 'alert-circle' : 'info';
    banner.className = `rounded-2xl p-3.5 flex items-start gap-3 text-xs border ${styles}`;
    banner.innerHTML = `<i data-lucide="${iconName}" class="w-4 h-4 shrink-0 mt-0.5"></i><div>${htmlMessage}</div>`;
    if (window.lucide) window.lucide.createIcons();
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
    const d = new Date(`${dateStr}T00:00:00`);
    d.setDate(d.getDate() + days);
    return d.toISOString().split('T')[0];
  }

  function findPreviousKnownLiveRate(hotelId, currentCheckin) {
    const dates = Object.keys(dateSnapshots).sort().reverse();
    for (const d of dates) {
      if (d === currentCheckin) continue;
      const found = (dateSnapshots[d] || []).find((x) => {
        const r = Number(x.lowest_rate);
        return x.id === hotelId && !x.is_estimated && r > 100000 && r <= MAX_STANDARD_ROOM_RATE;
      });
      if (found) return Number(found.lowest_rate);
    }
    return 0;
  }

  function normalizeZeroSoldOut(hotels, checkin) {
    const sourceList = Array.isArray(hotels) && hotels.length > 0 ? hotels : defaultTrackedHotels;

    const validRates = sourceList
      .map((h) => Number(h.lowest_rate))
      .filter((n) => n > 100000 && n <= MAX_STANDARD_ROOM_RATE);

    const avgFallback = validRates.length > 0
      ? Math.round(validRates.reduce((a, b) => a + b, 0) / validRates.length / 5000) * 5000
      : 650000;

    return sourceList.map((h) => {
      let rate = Number(h.lowest_rate) || 0;
      let isEst = Boolean(h.is_estimated);

      if (rate <= 100000 || rate > MAX_STANDARD_ROOM_RATE) {
        const prevLiveRate = findPreviousKnownLiveRate(h.id, checkin);
        rate = prevLiveRate > 0 ? prevLiveRate : (Number(h.fallbackRate) || avgFallback);
        isEst = true;
      }

      const cleanOta = (val, mult) => {
        const n = Number(val) || 0;
        if (n > 100000 && n <= MAX_STANDARD_ROOM_RATE && n <= rate * 1.6) return n;
        return Math.round((rate * mult) / 1000) * 1000;
      };

      const ota = h.ota_breakdown || {};
      const filteredAllOta = Array.isArray(h.all_ota_rates)
        ? h.all_ota_rates.filter((x) => {
            const val = Number(x.rate);
            return val > 100000 && val <= MAX_STANDARD_ROOM_RATE && val <= rate * 1.6;
          })
        : [];

      return {
        ...h,
        status: 'AVAILABLE',
        is_estimated: isEst,
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

  function computeMetrics(hotels) {
    const scoped = getGroupFilteredHotels(hotels);
    const offset = parseInt(document.getElementById('offsetSelect')?.value || '0', 10) || 0;
    const ownHotel = scoped.find((h) => h.isOwn) || hotels.find((h) => h.isOwn);
    const competitors = scoped.filter((h) => !h.isOwn);
    const activeCompetitors = competitors.filter((h) => Number(h.lowest_rate) > 0);

    const marketAvg = activeCompetitors.length > 0
      ? activeCompetitors.reduce((s, x) => s + Number(x.lowest_rate), 0) / activeCompetitors.length
      : 0;

    const recommendedBar = marketAvg > 0
      ? Math.round((marketAvg + offset) / 5000) * 5000
      : 0;

    const sortedActive = [...activeCompetitors].sort((a, b) => Number(a.lowest_rate) - Number(b.lowest_rate));
    const lowestComp = sortedActive[0] || null;

    let disparityAlerts = 0;
    scoped.forEach((h) => {
      const o = h.ota_breakdown || {};
      const rates = [o.traveloka, o.tiket, o.agoda, o.booking].map(Number).filter((v) => v > 0);
      if (rates.length >= 2 && (Math.max(...rates) - Math.min(...rates)) >= 35000) {
        disparityAlerts += 1;
      }
    });

    const parityRate = scoped.length > 0
      ? Math.max(0, Math.round(((scoped.length - disparityAlerts) / scoped.length) * 100))
      : 100;

    const ownRate = Number(ownHotel?.lowest_rate) || 0;
    const rateIndexPct = marketAvg > 0 && ownRate > 0
      ? Math.round((ownRate / marketAvg) * 100)
      : 100;

    return {
      scoped,
      ownHotel,
      competitors,
      activeCompetitors,
      marketAvg,
      recommendedBar,
      lowestComp,
      disparityAlerts,
      parityRate,
      ownRate,
      rateIndexPct
    };
  }

  function recordLocalSnapshotHistory(checkin, hotels, fetchedAt) {
    const m = computeMetrics(hotels);
    const alerts = [m.disparityAlerts > 0 ? `${m.disparityAlerts} OTA Disparity` : 'Full Parity'];

    const entry = {
      id: Date.now(),
      time: formatTimeWITA(fetchedAt),
      checkin,
      ownStatus: 'AVAILABLE',
      ownLowest: m.ownRate,
      marketAvg: Math.round(m.marketAvg),
      recommendedBar: m.recommendedBar,
      openCount: m.activeCompetitors.length,
      totalComp: m.competitors.length,
      alertSummary: alerts.join(' • ')
    };

    historyLogs.unshift(entry);
    historyLogs = historyLogs.slice(0, 60);
    localStorage.setItem('bpn_history_logs', JSON.stringify(historyLogs));
  }

  async function loadCachedSnapshot(targetDate = null) {
    const checkin = targetDate || getActiveCheckin();

    if (Array.isArray(dateSnapshots[checkin]) && dateSnapshots[checkin].length > 0) {
      currentHotels = normalizeZeroSoldOut(dateSnapshots[checkin], checkin);
      setBadge('bg-sky-600 text-white', 'Saved Snapshot');
      renderActiveView();
    } else {
      currentHotels = normalizeZeroSoldOut(defaultTrackedHotels, checkin);
      setBadge('bg-slate-600 text-white', 'Ready (0 Quota)');
      renderActiveView();
    }

    if (!apiEndpoint) return;

    try {
      const res = await fetch(`${apiEndpoint}?checkin=${encodeURIComponent(checkin)}&cached=1`);
      if (!res.ok) return;
      const data = await res.json();
      if (data && data.cached && Array.isArray(data.hotels) && data.hotels.length > 0) {
        const normalized = normalizeZeroSoldOut(data.hotels, checkin);
        dateSnapshots[checkin] = normalized;
        localStorage.setItem('bpn_date_snapshots', JSON.stringify(dateSnapshots));
        if (checkin === getActiveCheckin()) {
          currentHotels = normalized;
          const lu = document.getElementById('lastUpdateText');
          if (lu) lu.textContent = formatTimeWITA(data.fetched_at);
          setBadge('bg-sky-600 text-white', 'Saved Snapshot');
          renderActiveView();
        }
      }
    } catch {
      // Tetap gunakan cache lokal jika koneksi tertunda
    }
  }

  async function fetchLiveRates(targetDate = null, silent = false) {
    const checkin = targetDate || getActiveCheckin();
    const icon = document.getElementById('spinIcon');

    if (!silent && icon) icon.classList.add('animate-spin');
    if (!silent) setBadge('bg-amber-400 text-slate-900', 'Syncing OTA...');

    try {
      const res = await fetch(`${apiEndpoint}?checkin=${encodeURIComponent(checkin)}`);
      const text = await res.text();
      let data;
      try {
        data = JSON.parse(text);
      } catch {
        throw new Error(text.slice(0, 140) || 'Invalid server response');
      }
      if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);

      const normalized = normalizeZeroSoldOut(Array.isArray(data.hotels) ? data.hotels : [], checkin);
      dateSnapshots[checkin] = normalized;
      localStorage.setItem('bpn_date_snapshots', JSON.stringify(dateSnapshots));

      if (!targetDate || targetDate === getActiveCheckin()) {
        currentHotels = normalized;
        const lu = document.getElementById('lastUpdateText');
        if (lu) lu.textContent = formatTimeWITA(data.fetched_at);
      }

      setBadge('bg-emerald-500 text-white', data.supabase_saved ? 'Synced + Cloud' : 'Synced Live');
      showAlert(null, '');

      recordLocalSnapshotHistory(checkin, normalized, data.fetched_at);
      renderActiveView();
      return normalized;
    } catch (err) {
      setBadge('bg-rose-500 text-white', 'API Error');
      showAlert('error', `<strong>Sync Failed:</strong> ${err.message}`);
      return null;
    } finally {
      if (!silent && icon) setTimeout(() => icon.classList.remove('animate-spin'), 350);
    }
  }

  function renderSummaryDashboard(m) {
    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('recommendedRateText', m.recommendedBar > 0 ? formatIDR(m.recommendedBar) : 'IDR 0');
    setTxt('summaryPlatinumRate', m.ownRate > 0 ? formatIDR(m.ownRate) : 'IDR 0');

    const diffFromAvg = m.ownRate > 0 && m.marketAvg > 0 ? Math.round(m.ownRate - m.marketAvg) : 0;
    const diffSign = diffFromAvg > 0 ? '+' : '';
    setTxt(
      'summaryRateIndexSub',
      m.marketAvg > 0 ? `Index ${m.rateIndexPct}% (${diffSign}${formatNum(diffFromAvg)} vs Avg)` : 'Awaiting snapshot'
    );

    setTxt('summaryMarketAvg', m.marketAvg > 0 ? formatIDR(m.marketAvg) : 'IDR 0');
    setTxt(
      'summaryLowestCompset',
      m.lowestComp ? `Lowest: ${formatIDR(m.lowestComp.lowest_rate)} (${m.lowestComp.name.split(' ')[0]})` : 'Lowest: -'
    );

    setTxt('summaryParityScore', `${m.parityRate}% Parity`);
    setTxt(
      'summaryDisparityCount',
      m.disparityAlerts > 0 ? `${m.disparityAlerts} Channel Spread Alerts` : 'All Channels Balanced'
    );

    setTxt('summarySuggestedBar', m.recommendedBar > 0 ? formatIDR(m.recommendedBar) : 'IDR 0');
    setTxt('summaryTxnCount', `${historyLogs.length} Logged Scans • ${m.activeCompetitors.length}/${m.competitors.length} Active`);
  }

  function renderDailyTable(m) {
    const tbody = document.getElementById('rateTableBody');
    if (!tbody) return;
    tbody.innerHTML = '';

    const statusFilter = document.getElementById('statusFilterSelect')?.value || 'ALL';
    const filtered = m.scoped.filter((h) => {
      if (statusFilter === 'LIVE') return !h.is_estimated;
      if (statusFilter === 'ESTIMATED') return Boolean(h.is_estimated);
      return true;
    });

    filtered.forEach((h) => {
      const ota = h.ota_breakdown || {};
      const otaList = Array.isArray(h.all_ota_rates) && h.all_ota_rates.length > 0
        ? h.all_ota_rates.map((x) => `<span class="inline-block bg-sky-50 text-phb-blue border border-sky-200 rounded px-1.5 py-0.5 text-[10px] font-semibold mono">${x.source}: ${formatNum(x.rate)}</span>`).join(' ')
        : '';

      const otaRates = [ota.traveloka, ota.tiket, ota.agoda, ota.booking].map(Number).filter((v) => v > 0);
      const otaGap = otaRates.length >= 2 ? Math.max(...otaRates) - Math.min(...otaRates) : 0;
      const spread = m.marketAvg > 0 ? Math.round(Number(h.lowest_rate) - m.marketAvg) : 0;

      const parityBadge = otaGap >= 35000
        ? `<span class="inline-block whitespace-nowrap px-2 py-0.5 text-[10px] font-bold rounded bg-amber-100 text-amber-900">Disparity ${formatNum(otaGap)}</span>`
        : '<span class="inline-block whitespace-nowrap px-2 py-0.5 text-[10px] font-bold rounded bg-emerald-100 text-emerald-700">In Parity</span>';

      const groupTag = h.isOwn
        ? '<span class="px-1.5 py-0.5 text-[10px] font-extrabold rounded bg-phb-amber text-slate-900">PLATINUM</span>'
        : `<span class="px-1.5 py-0.5 text-[10px] font-bold rounded ${h.group === 'CORE' ? 'bg-sky-100 text-phb-blue' : 'bg-slate-100 text-slate-600'}">${h.group === 'CORE' ? 'CORE' : 'EXT'}</span>`;

      const statusBadge = h.is_estimated
        ? '<span class="inline-block whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-sky-100 text-phb-blue border border-sky-200">ESTIMATED</span>'
        : '<span class="inline-block whitespace-nowrap px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">AVAILABLE</span>';

      const tr = document.createElement('tr');
      tr.className = h.isOwn ? 'bg-amber-50/70 hover:bg-amber-50 transition' : 'bg-white hover:bg-slate-50 transition';
      tr.innerHTML = `
        <td class="py-3 px-4 border-r border-slate-200">
          <div class="flex flex-wrap items-center gap-2">
            ${groupTag}
            <span class="font-bold text-slate-800">${h.name}</span>
          </div>
          <span class="block text-[11px] text-slate-500 mt-0.5">${h.area}</span>
          ${otaList ? `<div class="flex flex-wrap gap-1 mt-1.5">${otaList}</div>` : ''}
        </td>
        <td class="py-3 px-2.5 text-center border-r border-slate-200">${statusBadge}</td>
        <td class="py-3 px-3 text-right mono border-r border-slate-200 text-slate-700 font-semibold">${formatNum(ota.traveloka)}</td>
        <td class="py-3 px-3 text-right mono border-r border-slate-200 text-slate-700 font-semibold">${formatNum(ota.tiket)}</td>
        <td class="py-3 px-3 text-right mono border-r border-slate-200 text-slate-700 font-semibold">${formatNum(ota.agoda)}</td>
        <td class="py-3 px-3 text-right mono border-r border-slate-200 text-slate-700 font-semibold">${formatNum(ota.booking)}</td>
        <td class="py-3 px-3 text-right mono font-bold border-r border-slate-200 bg-amber-50/80 text-amber-900">${formatNum(h.lowest_rate)}</td>
        <td class="py-3 px-3 text-right mono font-bold border-r border-slate-200 ${spread < 0 ? 'text-emerald-600' : spread > 0 ? 'text-rose-600' : 'text-phb-blue'}">${(spread > 0 ? '+' : '') + formatNum(spread)}</td>
        <td class="py-3 px-3 text-center">${parityBadge}</td>
      `;
      tbody.appendChild(tr);
    });
  }

  function renderGrid7View(startDate) {
    const head = document.getElementById('grid7Head');
    const body = document.getElementById('grid7Body');
    if (!head || !body) return;

    const dates = Array.from({ length: 7 }, (_, i) => addDays(startDate, i));
    head.innerHTML = `
      <tr>
        <th class="py-3 px-4 border-r border-white/15">Competitor Set Property</th>
        ${dates.map((d) => `<th class="py-3 px-2.5 text-center border-r border-white/15 cursor-pointer hover:bg-phb-darkblue" onclick="selectDateFromGrid('${d}')">${d.slice(5)}</th>`).join('')}
      </tr>
    `;

    const scoped = getGroupFilteredHotels(currentHotels);
    body.innerHTML = '';
    scoped.forEach((base) => {
      const tr = document.createElement('tr');
      tr.className = base.isOwn ? 'bg-amber-50/60' : 'bg-white';
      const cells = dates.map((d) => {
        const snap = (dateSnapshots[d] || []).find((x) => x.id === base.id);
        const rate = Number(snap?.lowest_rate) > 0 && Number(snap.lowest_rate) <= MAX_STANDARD_ROOM_RATE
          ? Number(snap.lowest_rate)
          : (Number(base.lowest_rate) || Number(base.fallbackRate) || 650000);
        return `<td class="py-2.5 px-2.5 text-center mono font-semibold text-slate-800 border-r border-slate-200">${formatNum(rate)}</td>`;
      }).join('');

      tr.innerHTML = `<td class="py-2.5 px-4 font-bold text-slate-800 border-r border-slate-200">${base.isOwn ? '★ ' : ''}${base.name}</td>${cells}`;
      body.appendChild(tr);
    });
  }

  function renderTransactionDashboard(m) {
    const txns = [...historyLogs];
    const uniqueDates = new Set(txns.map((x) => x.checkin).filter(Boolean));
    const avgPlat = txns.length > 0 ? Math.round(txns.reduce((s, x) => s + (Number(x.ownLowest) || 0), 0) / txns.length) : m.ownRate;
    const avgComp = txns.length > 0 ? Math.round(txns.reduce((s, x) => s + (Number(x.marketAvg) || 0), 0) / txns.length) : Math.round(m.marketAvg);
    const avgBar = txns.length > 0 ? Math.round(txns.reduce((s, x) => s + (Number(x.recommendedBar) || 0), 0) / txns.length) : m.recommendedBar;

    const setTxt = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setTxt('dashTotalTxns', String(txns.length));
    setTxt('dashTxnDates', `Across ${uniqueDates.size} check-in dates`);
    setTxt('dashAvgPlatinum', formatIDR(avgPlat));
    setTxt('dashAvgCompset', formatIDR(avgComp));
    setTxt('dashAvgBar', formatIDR(avgBar));

    const body = document.getElementById('dashboardReportBody');
    if (body) {
      if (txns.length === 0) {
        body.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No transaction records yet. Click <strong>Check OTA Now</strong> to record an OTA rate shopping scan.</td></tr>`;
      } else {
        body.innerHTML = txns.map((row) => {
          const pRate = Number(row.ownLowest) || 0;
          const cAvg = Number(row.marketAvg) || 0;
          const spread = pRate > 0 && cAvg > 0 ? pRate - cAvg : 0;
          return `
            <tr class="hover:bg-slate-50">
              <td class="py-2.5 px-4 mono text-slate-600">${row.time || '-'}</td>
              <td class="py-2.5 px-3 mono font-bold text-phb-blue">${row.checkin || '-'}</td>
              <td class="py-2.5 px-3 text-right mono font-bold text-amber-900">${formatNum(pRate)}</td>
              <td class="py-2.5 px-3 text-right mono font-semibold text-phb-blue">${formatNum(cAvg)}</td>
              <td class="py-2.5 px-3 text-right mono font-bold ${spread < 0 ? 'text-emerald-600' : spread > 0 ? 'text-rose-600' : 'text-slate-600'}">${spread === 0 ? '-' : (spread > 0 ? '+' : '') + formatNum(spread)}</td>
              <td class="py-2.5 px-3 text-right mono font-bold text-emerald-700">${formatNum(row.recommendedBar)}</td>
              <td class="py-2.5 px-3 text-center mono">${row.openCount || 0} / ${row.totalComp || 20}</td>
              <td class="py-2.5 px-4 text-slate-700">${row.alertSummary || 'Full Parity'}</td>
            </tr>
          `;
        }).join('');
      }
    }

    renderCharts(txns, m);
  }

  function renderCharts(txns, m) {
    if (typeof Chart === 'undefined') return;

    const ordered = [...txns].reverse().slice(-12);
    const labels = ordered.length > 0
      ? ordered.map((x) => `${x.checkin || ''} (${(x.time || '').slice(0, 5)})`)
      : [getActiveCheckin()];

    const platSeries = ordered.length > 0
      ? ordered.map((x) => Number(x.ownLowest) || m.ownRate || 0)
      : [m.ownRate || 0];

    const compSeries = ordered.length > 0
      ? ordered.map((x) => Number(x.marketAvg) || Math.round(m.marketAvg) || 0)
      : [Math.round(m.marketAvg) || 0];

    const barSeries = ordered.length > 0
      ? ordered.map((x) => Number(x.recommendedBar) || m.recommendedBar || 0)
      : [m.recommendedBar || 0];

    const trendCanvas = document.getElementById('rateTrendChart');
    if (trendCanvas) {
      if (trendChartInstance) trendChartInstance.destroy();
      trendChartInstance = new Chart(trendCanvas.getContext('2d'), {
        type: 'line',
        data: {
          labels,
          datasets: [
            { label: 'Platinum Rate', data: platSeries, borderColor: '#C59B27', backgroundColor: 'rgba(245, 184, 28, 0.18)', tension: 0.3, borderWidth: 2.5 },
            { label: 'Compset Avg', data: compSeries, borderColor: '#00669E', backgroundColor: 'rgba(0, 102, 158, 0.12)', tension: 0.3, borderWidth: 2.5 },
            { label: 'Suggested BAR', data: barSeries, borderColor: '#059669', backgroundColor: 'rgba(5, 150, 105, 0.12)', borderDash: [5, 5], tension: 0.3, borderWidth: 2 }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom', labels: { boxWidth: 12, font: { size: 11 } } } },
          scales: {
            y: { ticks: { font: { size: 10 }, callback: (v) => Number(v).toLocaleString('en-US') } },
            x: { ticks: { font: { size: 10 }, maxRotation: 25 } }
          }
        }
      });
    }

    const otaSums = { traveloka: 0, tiket: 0, agoda: 0, booking: 0, counts: 0 };
    m.scoped.forEach((h) => {
      const o = h.ota_breakdown || {};
      if (Number(o.traveloka) > 0 || Number(o.tiket) > 0 || Number(o.agoda) > 0 || Number(o.booking) > 0) {
        otaSums.traveloka += Number(o.traveloka) || 0;
        otaSums.tiket += Number(o.tiket) || 0;
        otaSums.agoda += Number(o.agoda) || 0;
        otaSums.booking += Number(o.booking) || 0;
        otaSums.counts += 1;
      }
    });
    const div = otaSums.counts || 1;
    const otaAvgs = [
      Math.round(otaSums.traveloka / div),
      Math.round(otaSums.tiket / div),
      Math.round(otaSums.agoda / div),
      Math.round(otaSums.booking / div)
    ];

    const otaCanvas = document.getElementById('otaChannelChart');
    if (otaCanvas) {
      if (otaChartInstance) otaChartInstance.destroy();
      otaChartInstance = new Chart(otaCanvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['Traveloka', 'Tiket.com', 'Agoda', 'Booking.com'],
          datasets: [{
            label: 'Average OTA Rate (IDR)',
            data: otaAvgs,
            backgroundColor: ['#00669E', '#1B85B8', '#F5B81C', '#059669'],
            borderRadius: 8
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: false, ticks: { font: { size: 10 }, callback: (v) => Number(v).toLocaleString('en-US') } },
            x: { ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  }

  function renderHistoryView() {
    const tbody = document.getElementById('historyTableBody');
    if (!tbody) return;
    if (historyLogs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" class="py-8 text-center text-slate-500">No scan history saved yet. Click <strong>Load Supabase (0 Quota)</strong> to fetch cloud logs.</td></tr>`;
      return;
    }

    tbody.innerHTML = historyLogs.map((row) => `
      <tr class="hover:bg-slate-50">
        <td class="py-2.5 px-4 mono text-slate-600">${row.time || '-'}</td>
        <td class="py-2.5 px-3 mono font-bold text-phb-blue">${row.checkin}</td>
        <td class="py-2.5 px-3 font-bold text-emerald-600">AVAILABLE</td>
        <td class="py-2.5 px-3 text-right mono">${row.ownLowest > 0 ? formatNum(row.ownLowest) : '-'}</td>
        <td class="py-2.5 px-3 text-right mono font-semibold">${row.marketAvg > 0 ? formatNum(row.marketAvg) : '-'}</td>
        <td class="py-2.5 px-3 text-right mono font-bold text-amber-800">${row.recommendedBar > 0 ? formatNum(row.recommendedBar) : '-'}</td>
        <td class="py-2.5 px-3 text-center mono">${row.openCount} / ${row.totalComp}</td>
        <td class="py-2.5 px-4 text-slate-700">${row.alertSummary || '-'}</td>
      </tr>
    `).join('');
  }

  function renderActiveView() {
    const checkin = getActiveCheckin();
    const pill = document.getElementById('activeDatePill');
    if (pill) pill.textContent = checkin;

    const m = computeMetrics(currentHotels);
    renderSummaryDashboard(m);
    renderDailyTable(m);
    renderGrid7View(checkin);
    renderTransactionDashboard(m);
    renderHistoryView();
  }

  // Expose handlers globally for inline HTML attributes
  window.toggleDescriptionPanel = () => {
    const box = document.getElementById('dashboardDescriptionBox');
    const txt = document.getElementById('descToggleText');
    if (!box || !txt) return;
    const willOpen = box.classList.contains('hidden');
    box.classList.toggle('hidden', !willOpen);
    txt.textContent = willOpen ? 'Close Description' : 'Description';
  };

  window.setViewMode = (mode) => {
    currentView = mode;
    ['DAILY', 'GRID7', 'DASHBOARD', 'HISTORY'].forEach((m) => {
      const panel = document.getElementById('panel' + m);
      const btn = document.getElementById('view' + m);
      if (panel) panel.classList.toggle('hidden', m !== mode);
      if (btn) {
        btn.className = m === mode
          ? 'min-h-[36px] px-3 py-1.5 rounded-lg font-bold bg-phb-blue text-white transition text-center touch-manipulation'
          : 'min-h-[36px] px-3 py-1.5 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 transition text-center touch-manipulation';
      }
    });
    renderActiveView();
  };

  window.handleDateChange = () => loadCachedSnapshot(getActiveCheckin());
  window.fetchLiveRates = fetchLiveRates;
  window.renderActiveView = renderActiveView;

  window.selectDateFromGrid = (d) => {
    const el = document.getElementById('checkinInput');
    if (el) el.value = d;
    window.setViewMode('DAILY');
    window.handleDateChange();
  };

  window.scanNext7Days = async () => {
    const btn = document.getElementById('scan7Btn');
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Scanning 7 Days...';
    }
    const start = getActiveCheckin();
    for (let i = 0; i < 7; i++) {
      await fetchLiveRates(addDays(start, i), true);
    }
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Scan 7 Days';
    }
    renderGrid7View(start);
  };

  window.syncHistoryFromSupabase = async () => {
    if (!apiEndpoint) return;
    try {
      const res = await fetch(`${apiEndpoint}?logs=1`);
      if (!res.ok) return;
      const data = await res.json();
      if (Array.isArray(data.logs) && data.logs.length > 0) {
        historyLogs = data.logs;
        localStorage.setItem('bpn_history_logs', JSON.stringify(historyLogs));
        renderActiveView();
      }
    } catch {}
  };

  window.clearLocalHistory = () => {
    historyLogs = [];
    localStorage.removeItem('bpn_history_logs');
    renderActiveView();
  };

  window.configureAutoPoll = () => {
    if (pollTimer) clearInterval(pollTimer);
    const ms = parseInt(document.getElementById('autoPollSelect')?.value || '0', 10) || 0;
    if (ms > 0) pollTimer = setInterval(() => fetchLiveRates(null, true), ms);
  };

  window.exportCSV = () => {
    const checkin = getActiveCheckin();
    const m = computeMetrics(currentHotels);
    let csv = 'CheckIn,Group,Hotel,Status,SourceMode,Traveloka,Tiket,Agoda,Booking,LowestRate,SuggestedBAR\n';
    m.scoped.forEach((h) => {
      const o = h.ota_breakdown || {};
      const mode = h.is_estimated ? 'ESTIMATED' : 'LIVE_OTA';
      csv += `${checkin},${h.group || 'CORE'},"${h.name}",AVAILABLE,${mode},${o.traveloka || 0},${o.tiket || 0},${o.agoda || 0},${o.booking || 0},${h.lowest_rate || 0},${m.recommendedBar || 0}\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PHB_RateShop_${checkin}.csv`;
    link.click();
  };

  window.exportTransactionReportCSV = () => {
    let csv = 'ScanTime,CheckIn,PlatinumRate,CompsetAvg,SuggestedBAR,ActiveHotels,TotalHotels,ParityStatus\n';
    historyLogs.forEach((row) => {
      csv += `"${row.time || ''}","${row.checkin || ''}",${row.ownLowest || 0},${row.marketAvg || 0},${row.recommendedBar || 0},${row.openCount || 0},${row.totalComp || 0},"${row.alertSummary || 'Full Parity'}"\n`;
    });
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `PHB_Transaction_Report.csv`;
    link.click();
  };

  document.addEventListener('DOMContentLoaded', () => {
    const checkinEl = document.getElementById('checkinInput');
    if (checkinEl) checkinEl.value = tomorrowStr;
    if (window.lucide) lucide.createIcons();
    loadCachedSnapshot(tomorrowStr);
    window.syncHistoryFromSupabase();
  });
})();
