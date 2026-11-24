module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const fetchWithTimeout = async (url, options = {}, timeoutMs = 10000) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      return await fetch(url, { ...options, signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const query = req.query || {};
    const checkin = String(query.checkin || new Date(Date.now() + 86400000).toISOString().split('T')[0]);
    const checkout = new Date(new Date(`${checkin}T00:00:00Z`).getTime() + 86400000).toISOString().split('T')[0];
    const cachedOnly = query.cached === '1';
    const loadLogsOnly = query.logs === '1';

    const sbUrl = (process.env.SUPABASE_URL || 'https://hupvhnvztvzqbdhuukpt.supabase.co').replace(/\/+$/, '');
    const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

    // 1. Load history logs from Supabase (0 SerpApi Quota)
    if (loadLogsOnly) {
      if (!sbUrl || !sbKey) return res.status(200).json({ logs: [] });
      try {
        const r = await fetchWithTimeout(
          `${sbUrl}/rest/v1/rate_shop_logs?select=payload,fetched_at&order=fetched_at.desc&limit=60`,
          { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
          8000
        );
        const rows = await r.json();
        const logs = Array.isArray(rows) ? rows.map((x) => x.payload).filter(Boolean) : [];
        return res.status(200).json({ logs });
      } catch {
        return res.status(200).json({ logs: [] });
      }
    }

    // 2. Load saved snapshot from Supabase per check-in date (0 SerpApi Quota)
    if (cachedOnly) {
      if (!sbUrl || !sbKey) return res.status(200).json({ cached: false, hotels: [] });
      try {
        const r = await fetchWithTimeout(
          `${sbUrl}/rest/v1/rate_shop_snapshots?checkin_date=eq.${encodeURIComponent(checkin)}&select=checkin_date,checkout_date,fetched_at,hotels&limit=1`,
          { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } },
          8000
        );
        const rows = await r.json();
        if (Array.isArray(rows) && rows.length > 0 && Array.isArray(rows[0].hotels)) {
          return res.status(200).json({
            cached: true,
            checkin: rows[0].checkin_date,
            checkout: rows[0].checkout_date,
            fetched_at: rows[0].fetched_at,
            hotels: rows[0].hotels
          });
        }
        return res.status(200).json({ cached: false, hotels: [] });
      } catch {
        return res.status(200).json({ cached: false, hotels: [] });
      }
    }

    const apiKey = process.env.SERPAPI_KEY;
    if (!apiKey) {
      return res.status(400).json({ error: 'SERPAPI_KEY belum dikonfigurasi di Vercel Environment Variables.' });
    }

    const tracked = [
      { id: 'platinum', group: 'CORE', fallbackRate: 850000, matchKeys: ['platinum'], queryName: 'Platinum Hotel & Convention Hall Balikpapan', name: 'Platinum Hotel & Convention Hall Balikpapan', area: 'Jl. Soekarno Hatta, Balikpapan', isOwn: true },
      { id: 'bluesky', group: 'CORE', fallbackRate: 780000, matchKeys: ['blue sky', 'bluesky'], queryName: 'Blue Sky Hotel Balikpapan', name: 'Blue Sky Hotel Balikpapan', area: 'Kebun Sayur, Balikpapan', isOwn: false },
      { id: 'swissbel_balcony', group: 'CORE', fallbackRate: 810000, matchKeys: ['swiss-belhotel', 'swiss belhotel'], queryName: 'Swiss-Belhotel Balikpapan', name: 'Swiss-Belhotel Balikpapan', area: 'Balikpapan Ocean Square (BOS)', isOwn: false },
      { id: 'novotel', group: 'CORE', fallbackRate: 1150000, matchKeys: ['novotel'], queryName: 'Novotel Balikpapan', name: 'Novotel Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
      { id: 'grand_jatra', group: 'CORE', fallbackRate: 1050000, matchKeys: ['jatra'], queryName: 'Grand Jatra Hotel Balikpapan', name: 'Grand Jatra Hotel Balikpapan', area: 'e-Walk / Balikpapan SuperBlock', isOwn: false },
      { id: 'grand_tjokro', group: 'CORE', fallbackRate: 540000, matchKeys: ['tjokro'], queryName: 'Grand Tjokro Balikpapan', name: 'Grand Tjokro Balikpapan', area: 'Jl. Marsma R. Iswahyudi', isOwn: false },
      { id: 'astara', group: 'CORE', fallbackRate: 920000, matchKeys: ['astara'], queryName: 'Astara Hotel Balikpapan', name: 'Astara Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'gran_senyiur', group: 'EXTENDED', fallbackRate: 670000, matchKeys: ['senyiur'], queryName: 'Gran Senyiur Balikpapan', name: 'Gran Senyiur Balikpapan', area: 'Jl. ARS Moh. No. 1-7', isOwn: false },
      { id: 'horison_ultima', group: 'EXTENDED', fallbackRate: 470000, matchKeys: ['horison'], queryName: 'Horison Ultima Benua Balikpapan', name: 'Horison Ultima Benua Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'penta_city', group: 'EXTENDED', fallbackRate: 560000, matchKeys: ['penta'], queryName: 'Penta City Hotel Balikpapan', name: 'Penta City Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'golden_tulip', group: 'EXTENDED', fallbackRate: 850000, matchKeys: ['golden tulip'], queryName: 'Golden Tulip Balikpapan Hotel & Suites', name: 'Golden Tulip Balikpapan Hotel & Suites', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'dprima', group: 'EXTENDED', fallbackRate: 430000, matchKeys: ['prima', 'dprima'], queryName: "D'Prima Hotel Balikpapan", name: "D'Prima Hotel Balikpapan", area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'pacific', group: 'EXTENDED', fallbackRate: 350000, matchKeys: ['pacific'], queryName: 'Pacific Hotel Balikpapan', name: 'Pacific Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'sagita', group: 'EXTENDED', fallbackRate: 420000, matchKeys: ['sagita'], queryName: 'Sagita Hotel Balikpapan', name: 'Sagita Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'ibis', group: 'EXTENDED', fallbackRate: 510000, matchKeys: ['ibis'], queryName: 'ibis Balikpapan', name: 'ibis Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
      { id: 'quest', group: 'EXTENDED', fallbackRate: 460000, matchKeys: ['quest'], queryName: 'Quest Hotel Balikpapan', name: 'Quest Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'neo_plus', group: 'EXTENDED', fallbackRate: 440000, matchKeys: ['neo+', 'neo plus', 'hotel neo', ' neo '], queryName: 'Hotel NEO+ Balikpapan', name: 'Hotel NEO+ Balikpapan', area: 'Jl. Podomoro / MT Haryono', isOwn: false },
      { id: 'zurich', group: 'EXTENDED', fallbackRate: 410000, matchKeys: ['zurich'], queryName: 'Zurich Hotel Balikpapan', name: 'Zurich Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'swissbel_inn', group: 'EXTENDED', fallbackRate: 530000, matchKeys: ['swiss-belinn', 'swiss belinn', 'belinn'], queryName: 'Swiss-Belinn Balikpapan', name: 'Swiss-Belinn Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'max_one', group: 'EXTENDED', fallbackRate: 390000, matchKeys: ['maxone', 'max one'], queryName: 'MaxOneHotels at Balikpapan', name: 'MaxOneHotels at Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
      { id: 'whiz', group: 'EXTENDED', fallbackRate: 360000, matchKeys: ['whiz'], queryName: 'Whiz Prime Hotel Balikpapan', name: 'Whiz Prime Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false }
    ];

    const toNum = (v) => {
      if (typeof v === 'number') {
        return Number.isFinite(v) && v >= 50000 ? Math.round(v) : 0;
      }
      if (!v) return 0;
      const cleaned = String(v).replace(/[^0-9]/g, '');
      const n = Number(cleaned);
      return Number.isFinite(n) && n >= 50000 ? Math.round(n) : 0;
    };

    const extractRealOtaPrice = (obj) => {
      if (!obj || typeof obj !== 'object') return 0;
      return (
        toNum(obj.rate_per_night && obj.rate_per_night.extracted_lowest) ||
        toNum(obj.rate_per_night && obj.rate_per_night.lowest) ||
        toNum(obj.total_rate && obj.total_rate.extracted_lowest) ||
        toNum(obj.total_rate && obj.total_rate.lowest) ||
        toNum(obj.extracted_lowest) ||
        toNum(obj.lowest) ||
        toNum(obj.extracted_price) ||
        toNum(obj.price) ||
        0
      );
    };

    const buildSerpUrl = (qText) =>
      `https://serpapi.com/search.json?engine=google_hotels` +
      `&q=${encodeURIComponent(qText)}` +
      `&check_in_date=${checkin}&check_out_date=${checkout}` +
      `&adults=2&currency=IDR&gl=id&hl=id&api_key=${encodeURIComponent(apiKey)}`;

    async function fetchDirectProperty(item) {
      try {
        const d = await fetchWithTimeout(buildSerpUrl(item.queryName || item.name), {}, 9500).then((r) => r.json());
        if (!d || d.error) return [];

        const results = [];
        if (d.rate_per_night || d.total_rate || Array.isArray(d.featured_prices) || Array.isArray(d.prices)) {
          results.push({
            ...d,
            name: d.name || item.name
          });
        }
        if (Array.isArray(d.properties)) {
          for (const p of d.properties) {
            const raw = String((p && p.name) || '').trim();
            if (!raw) continue;
            const low = ` ${raw.toLowerCase()} `;
            if (item.matchKeys.some((k) => low.includes(k.toLowerCase()))) {
              results.push(p);
            }
          }
        }
        return results;
      } catch {
        return [];
      }
    }

    // Tarik seluruh 21 hotel secara langsung (seperti Platinum) dalam batch paralel
    const allFetchedProps = [];
    const BATCH_SIZE = 7;
    for (let i = 0; i < tracked.length; i += BATCH_SIZE) {
      const batch = tracked.slice(i, i + BATCH_SIZE);
      const batchResults = await Promise.allSettled(batch.map((item) => fetchDirectProperty(item)));
      for (const r of batchResults) {
        if (r.status === 'fulfilled' && Array.isArray(r.value)) {
          allFetchedProps.push(...r.value);
        }
      }
    }

    const hotels = tracked.map((item) => {
      const matchingProps = allFetchedProps.filter((p) => {
        const raw = String((p && p.name) || '').trim();
        if (!raw) return false;
        const low = ` ${raw.toLowerCase()} `;
        return item.matchKeys.some((k) => low.includes(k.toLowerCase()));
      });

      const ota = { traveloka: 0, tiket: 0, agoda: 0, booking: 0 };
      const otaMap = new Map();
      let bestPrice = 0;
      let bestSource = '';
      let isEstimated = false;

      for (const found of matchingProps) {
        const propPrice = extractRealOtaPrice(found);
        const propSrc = String((found && found.rate_per_night && found.rate_per_night.source) || (found && found.source) || '').trim();
        if (propPrice > 0 && (!bestPrice || propPrice < bestPrice)) {
          bestPrice = propPrice;
          if (propSrc) bestSource = propSrc;
        }

        const offers = [
          ...(Array.isArray(found && found.featured_prices) ? found.featured_prices : []),
          ...(Array.isArray(found && found.prices) ? found.prices : [])
        ];

        for (const offer of offers) {
          if (!offer) continue;
          const src = String(offer.source || '').trim();
          const lowSrc = src.toLowerCase();
          const val = extractRealOtaPrice(offer);
          if (!val) continue;

          if (!bestPrice || val < bestPrice) {
            bestPrice = val;
            if (src) bestSource = src;
          }
          if (src) {
            const prev = otaMap.get(src);
            if (!prev || val < prev) otaMap.set(src, val);
          }
          if (lowSrc.includes('traveloka')) {
            if (!ota.traveloka || val < ota.traveloka) ota.traveloka = val;
          } else if (lowSrc.includes('tiket')) {
            if (!ota.tiket || val < ota.tiket) ota.tiket = val;
          } else if (lowSrc.includes('agoda')) {
            if (!ota.agoda || val < ota.agoda) ota.agoda = val;
          } else if (lowSrc.includes('booking')) {
            if (!ota.booking || val < ota.booking) ota.booking = val;
          }
        }
      }

      const allOtaRates = Array.from(otaMap.entries())
        .map(([source, rate]) => ({ source, rate }))
        .sort((a, b) => a.rate - b.rate);

      if (!bestPrice && allOtaRates.length > 0) {
        bestPrice = allOtaRates[0].rate;
        bestSource = allOtaRates[0].source;
      }

      if (!bestPrice) {
        bestPrice = item.fallbackRate;
        bestSource = 'Benchmark Rate';
        isEstimated = true;
      }

      if (bestPrice > 0 && !ota.traveloka && !ota.tiket && !ota.agoda && !ota.booking) {
        const lowBestSrc = bestSource.toLowerCase();
        if (lowBestSrc.includes('traveloka')) {
          ota.traveloka = bestPrice;
        } else if (lowBestSrc.includes('tiket')) {
          ota.tiket = bestPrice;
        } else if (lowBestSrc.includes('agoda')) {
          ota.agoda = bestPrice;
        } else if (lowBestSrc.includes('booking')) {
          ota.booking = bestPrice;
        } else {
          ota.traveloka = bestPrice;
        }
      }

      return {
        ...item,
        status: 'AVAILABLE',
        is_estimated: isEstimated,
        lowest_rate: bestPrice,
        lowest_source: bestSource || 'OTA',
        ota_breakdown: ota,
        all_ota_rates: allOtaRates
      };
    });

    async function saveToSupabase(checkinDate, checkoutDate, fetchedAt, listHotels) {
      if (!sbUrl || !sbUrl.startsWith('http') || !sbKey) return false;

      const ownHotel = listHotels.find((h) => h.isOwn);
      const competitors = listHotels.filter((h) => !h.isOwn);
      const openCompetitors = competitors.filter((h) => Number(h.lowest_rate) > 0);
      const marketAvg = openCompetitors.length > 0
        ? Math.round(openCompetitors.reduce((s, x) => s + Number(x.lowest_rate), 0) / openCompetitors.length)
        : 0;
      const recommendedBar = marketAvg > 0 ? Math.round(marketAvg / 5000) * 5000 : 0;

      const timeWita = new Date(fetchedAt).toLocaleTimeString('en-GB', {
        timeZone: 'Asia/Makassar',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      }) + ' WITA';

      const logPayload = {
        id: Date.now(),
        time: timeWita,
        checkin: checkinDate,
        ownStatus: 'AVAILABLE',
        ownLowest: Number((ownHotel && ownHotel.lowest_rate) || 0),
        marketAvg,
        recommendedBar,
        openCount: openCompetitors.length,
        totalComp: competitors.length,
        alertSummary: ownHotel && ownHotel.is_estimated ? 'Platinum Estimated • Compset Active' : 'Platinum Live • Compset Active'
      };

      const headers = {
        apikey: sbKey,
        Authorization: `Bearer ${sbKey}`,
        'Content-Type': 'application/json'
      };

      const resList = await Promise.allSettled([
        fetchWithTimeout(`${sbUrl}/rest/v1/rate_shop_logs`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'return=minimal' },
          body: JSON.stringify({
            checkin_date: checkinDate,
            fetched_at: fetchedAt,
            market_avg: marketAvg,
            recommended_bar: recommendedBar,
            payload: logPayload
          })
        }, 8000),
        fetchWithTimeout(`${sbUrl}/rest/v1/rate_shop_snapshots?on_conflict=checkin_date`, {
          method: 'POST',
          headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
          body: JSON.stringify({
            checkin_date: checkinDate,
            checkout_date: checkoutDate,
            fetched_at: fetchedAt,
            market_avg: marketAvg,
            recommended_bar: recommendedBar,
            hotels: listHotels
          })
        }, 8000)
      ]);

      return resList.every((r) => r.status === 'fulfilled' && r.value && r.value.ok);
    }

    const fetchedAt = new Date().toISOString();
    const supabaseSaved = await saveToSupabase(checkin, checkout, fetchedAt, hotels);

    return res.status(200).json({
      cached: false,
      checkin,
      checkout,
      fetched_at: fetchedAt,
      supabase_saved: supabaseSaved,
      total_properties_found: allFetchedProps.length,
      hotels
    });
  } catch (err) {
    return res.status(500).json({ error: (err && err.message) || 'Internal server error' });
  }
};
