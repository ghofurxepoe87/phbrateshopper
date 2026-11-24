export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const checkin = req.query.checkin || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const checkout = new Date(new Date(checkin).getTime() + 86400000).toISOString().split('T')[0];
  const cachedOnly = req.query.cached === '1';
  const loadLogsOnly = req.query.logs === '1';

  const sbUrl = (process.env.SUPABASE_URL || 'https://hupvhnvztvzqbdhuukpt.supabase.co').replace(/\/+$/, '');
  const sbKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || '';

  if (loadLogsOnly) {
    if (!sbUrl || !sbKey) return res.status(200).json({ logs: [] });
    try {
      const r = await fetch(
        `${sbUrl}/rest/v1/rate_shop_logs?select=payload,fetched_at&order=fetched_at.desc&limit=60`,
        { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
      );
      const rows = await r.json();
      const logs = Array.isArray(rows) ? rows.map((x) => x.payload).filter(Boolean) : [];
      return res.status(200).json({ logs });
    } catch {
      return res.status(200).json({ logs: [] });
    }
  }

  if (cachedOnly) {
    if (!sbUrl || !sbKey) return res.status(200).json({ cached: false, hotels: [] });
    try {
      const r = await fetch(
        `${sbUrl}/rest/v1/rate_shop_snapshots?checkin_date=eq.${encodeURIComponent(checkin)}&select=checkin_date,checkout_date,fetched_at,hotels&limit=1`,
        { headers: { apikey: sbKey, Authorization: `Bearer ${sbKey}` } }
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

  const tracked = [
    { id: 'platinum', group: 'CORE', fallbackRate: 850000, matchKeys: ['platinum'], name: 'Platinum Hotel & Convention Hall Balikpapan', area: 'Jl. Soekarno Hatta, Balikpapan', isOwn: true },
    { id: 'bluesky', group: 'CORE', fallbackRate: 780000, matchKeys: ['blue sky', 'bluesky'], name: 'Blue Sky Hotel Balikpapan', area: 'Kebun Sayur, Balikpapan', isOwn: false },
    { id: 'swissbel_balcony', group: 'CORE', fallbackRate: 810000, matchKeys: ['swiss-belhotel', 'swiss belhotel'], name: 'Swiss-Belhotel Balikpapan', area: 'Balikpapan Ocean Square (BOS)', isOwn: false },
    { id: 'novotel', group: 'CORE', fallbackRate: 1150000, matchKeys: ['novotel'], name: 'Novotel Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
    { id: 'grand_jatra', group: 'CORE', fallbackRate: 1050000, matchKeys: ['jatra'], name: 'Grand Jatra Hotel Balikpapan', area: 'e-Walk / Balikpapan SuperBlock', isOwn: false },
    { id: 'grand_tjokro', group: 'CORE', fallbackRate: 540000, matchKeys: ['tjokro'], name: 'Grand Tjokro Balikpapan', area: 'Jl. Marsma R. Iswahyudi', isOwn: false },
    { id: 'astara', group: 'CORE', fallbackRate: 920000, matchKeys: ['astara'], name: 'Astara Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'gran_senyiur', group: 'EXTENDED', fallbackRate: 670000, matchKeys: ['senyiur'], name: 'Gran Senyiur Balikpapan', area: 'Jl. ARS Moh. No. 1-7', isOwn: false },
    { id: 'horison_ultima', group: 'EXTENDED', fallbackRate: 470000, matchKeys: ['horison'], name: 'Horison Ultima Benua Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'penta_city', group: 'EXTENDED', fallbackRate: 560000, matchKeys: ['penta'], name: 'Penta City Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'golden_tulip', group: 'EXTENDED', fallbackRate: 850000, matchKeys: ['golden tulip'], name: 'Golden Tulip Balikpapan Hotel & Suites', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'dprima', group: 'EXTENDED', fallbackRate: 430000, matchKeys: ['prima', 'dprima'], name: "D'Prima Hotel Balikpapan", area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'pacific', group: 'EXTENDED', fallbackRate: 350000, matchKeys: ['pacific'], name: 'Pacific Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'sagita', group: 'EXTENDED', fallbackRate: 420000, matchKeys: ['sagita'], name: 'Sagita Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'ibis', group: 'EXTENDED', fallbackRate: 510000, matchKeys: ['ibis'], name: 'ibis Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
    { id: 'quest', group: 'EXTENDED', fallbackRate: 460000, matchKeys: ['quest'], name: 'Quest Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'neo_plus', group: 'EXTENDED', fallbackRate: 440000, matchKeys: ['neo+', 'neo plus', 'hotel neo', ' neo '], name: 'Hotel NEO+ Balikpapan', area: 'Jl. Podomoro / MT Haryono', isOwn: false },
    { id: 'zurich', group: 'EXTENDED', fallbackRate: 410000, matchKeys: ['zurich'], name: 'Zurich Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'swissbel_inn', group: 'EXTENDED', fallbackRate: 530000, matchKeys: ['swiss-belinn', 'swiss belinn', 'belinn'], name: 'Swiss-Belinn Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'max_one', group: 'EXTENDED', fallbackRate: 390000, matchKeys: ['maxone', 'max one'], name: 'MaxOneHotels at Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'whiz', group: 'EXTENDED', fallbackRate: 360000, matchKeys: ['whiz'], name: 'Whiz Prime Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false }
  ];

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'SERPAPI_KEY is not configured in Vercel Environment Variables.' });
  }

  const toNum = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) && v > 10000 ? Math.round(v) : 0;
    if (!v) return 0;
    const cleaned = String(v).replace(/[^0-9]/g, '');
    const n = Number(cleaned);
    return Number.isFinite(n) && n > 10000 ? Math.round(n) : 0;
  };

  const extractPrice = (obj) => {
    if (!obj || typeof obj !== 'object') return 0;
    return (
      toNum(obj.rate_per_night?.extracted_lowest) ||
      toNum(obj.rate_per_night?.lowest) ||
      toNum(obj.extracted_lowest) ||
      toNum(obj.lowest) ||
      toNum(obj.price) ||
      toNum(obj.total_rate?.extracted_lowest) ||
      0
    );
  };

  async function saveToSupabase(checkinDate, checkoutDate, fetchedAt, hotels) {
    if (!sbUrl || !sbUrl.startsWith('http') || !sbKey) return false;

    const ownHotel = hotels.find((h) => h.isOwn);
    const competitors = hotels.filter((h) => !h.isOwn);
    const openCompetitors = competitors.filter((h) => Number(h.lowest_rate) > 0);
    const marketAvg = openCompetitors.length > 0
      ? Math.round(openCompetitors.reduce((s, x) => s + Number(x.lowest_rate), 0) / openCompetitors.length)
      : 0;
    const recommendedBar = marketAvg > 0
      ? Math.round(marketAvg / 5000) * 5000
      : 0;

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
      ownLowest: Number(ownHotel?.lowest_rate) || 0,
      marketAvg,
      recommendedBar,
      openCount: openCompetitors.length,
      totalComp: competitors.length,
      alertSummary: 'Full Compset Active (No Sold Out)'
    };

    const headers = {
      apikey: sbKey,
      Authorization: `Bearer ${sbKey}`,
      'Content-Type': 'application/json'
    };

    const resList = await Promise.allSettled([
      fetch(`${sbUrl}/rest/v1/rate_shop_logs`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'return=minimal' },
        body: JSON.stringify({
          checkin_date: checkinDate,
          fetched_at: fetchedAt,
          market_avg: marketAvg,
          recommended_bar: recommendedBar,
          payload: logPayload
        })
      }),
      fetch(`${sbUrl}/rest/v1/rate_shop_snapshots?on_conflict=checkin_date`, {
        method: 'POST',
        headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({
          checkin_date: checkinDate,
          checkout_date: checkoutDate,
          fetched_at: fetchedAt,
          market_avg: marketAvg,
          recommended_bar: recommendedBar,
          hotels
        })
      })
    ]);

    return resList.every((r) => r.status === 'fulfilled' && r.value.ok);
  }

  try {
    const searchUrl =
      `https://serpapi.com/search.json?engine=google_hotels` +
      `&q=${encodeURIComponent('hotels in Balikpapan')}` +
      `&check_in_date=${checkin}&check_out_date=${checkout}` +
      `&currency=IDR&gl=id&hl=id&api_key=${encodeURIComponent(apiKey)}`;

    const response = await fetch(searchUrl);
    const json = await response.json();

    if (json.error) {
      return res.status(502).json({ error: String(json.error) });
    }

    const props = Array.isArray(json.properties) ? json.properties : [];
    const usedNames = new Set();

    const hotels = tracked.map((item) => {
      const found = props.find((p) => {
        const raw = String(p?.name || '').trim();
        if (!raw || usedNames.has(raw)) return false;
        const low = ` ${raw.toLowerCase()} `;
        return item.matchKeys.some((k) => low.includes(k.toLowerCase()));
      });
      if (found?.name) usedNames.add(String(found.name).trim());

      const offers = [
        ...(Array.isArray(found?.featured_prices) ? found.featured_prices : []),
        ...(Array.isArray(found?.prices) ? found.prices : [])
      ];

      const ota = { traveloka: 0, tiket: 0, agoda: 0, booking: 0 };
      const otaMap = new Map();
      let bestPrice = extractPrice(found);
      let bestSource = String(found?.rate_per_night?.source || found?.source || '').trim();
      let isEstimated = false;

      for (const offer of offers) {
        if (!offer) continue;
        const src = String(offer.source || '').trim();
        const lowSrc = src.toLowerCase();
        const val = extractPrice(offer);
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

      const allOtaRates = Array.from(otaMap.entries())
        .map(([source, rate]) => ({ source, rate }))
        .sort((a, b) => a.rate - b.rate);

      if (!bestPrice && allOtaRates.length > 0) {
        bestPrice = allOtaRates[0].rate;
        bestSource = allOtaRates[0].source;
      }

      // Pastikan tidak pernah berstatus SOLD OUT: gunakan fallback rate jika tidak ada rate live
      if (!bestPrice) {
        bestPrice = item.fallbackRate;
        bestSource = 'Benchmark Rate';
        isEstimated = true;
      }

      if (!ota.traveloka && !ota.tiket && !ota.agoda && !ota.booking && bestPrice > 0) {
        ota.traveloka = bestPrice;
        ota.tiket = Math.round((bestPrice * 1.01) / 1000) * 1000;
        ota.agoda = Math.round((bestPrice * 1.02) / 1000) * 1000;
        ota.booking = Math.round((bestPrice * 1.04) / 1000) * 1000;
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

    const fetchedAt = new Date().toISOString();
    const supabaseSaved = await saveToSupabase(checkin, checkout, fetchedAt, hotels);

    return res.status(200).json({
      cached: false,
      checkin,
      checkout,
      fetched_at: fetchedAt,
      supabase_saved: supabaseSaved,
      total_properties_found: props.length,
      hotels
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
