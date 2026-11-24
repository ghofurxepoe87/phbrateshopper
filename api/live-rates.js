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

  // 1. Mode baca riwayat log dari Supabase (0 Kuota SerpApi)
  if (loadLogsOnly) {
    if (!sbUrl || !sbKey) {
      return res.status(200).json({ logs: [] });
    }
    try {
      const r = await fetch(
        `${sbUrl}/rest/v1/rate_shop_logs?select=payload,fetched_at&order=fetched_at.desc&limit=60`,
        {
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`
          }
        }
      );
      const rows = await r.json();
      const logs = Array.isArray(rows) ? rows.map((x) => x.payload).filter(Boolean) : [];
      return res.status(200).json({ logs });
    } catch {
      return res.status(200).json({ logs: [] });
    }
  }

  // 2. Mode baca snapshot tersimpan dari Supabase (0 Kuota SerpApi)
  if (cachedOnly) {
    if (!sbUrl || !sbKey) {
      return res.status(200).json({ cached: false, hotels: [] });
    }
    try {
      const r = await fetch(
        `${sbUrl}/rest/v1/rate_shop_snapshots?checkin_date=eq.${encodeURIComponent(checkin)}&select=checkin_date,checkout_date,fetched_at,hotels&limit=1`,
        {
          headers: {
            apikey: sbKey,
            Authorization: `Bearer ${sbKey}`
          }
        }
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

  // 3. Mode Live Fetch ke SerpApi (Hanya dijalankan saat tombol "Cek OTA Sekarang" diklik)
  const tracked = [
    { id: 'platinum', group: 'CORE', matchKeys: ['platinum'], name: 'Platinum Hotel & Convention Hall Balikpapan', area: 'Jl. Soekarno Hatta, Balikpapan', isOwn: true },
    { id: 'bluesky', group: 'CORE', matchKeys: ['blue sky'], name: 'Blue Sky Hotel Balikpapan', area: 'Kebun Sayur, Balikpapan', isOwn: false },
    { id: 'swissbel_balcony', group: 'CORE', matchKeys: ['swiss-belhotel', 'swiss belhotel'], name: 'Swiss-Belhotel Balikpapan', area: 'Balikpapan Ocean Square (BOS)', isOwn: false },
    { id: 'novotel', group: 'CORE', matchKeys: ['novotel'], name: 'Novotel Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
    { id: 'grand_jatra', group: 'CORE', matchKeys: ['jatra'], name: 'Grand Jatra Hotel Balikpapan', area: 'e-Walk / Balikpapan SuperBlock', isOwn: false },
    { id: 'grand_tjokro', group: 'CORE', matchKeys: ['tjokro'], name: 'Grand Tjokro Balikpapan', area: 'Jl. Marsma R. Iswahyudi', isOwn: false },
    { id: 'astara', group: 'CORE', matchKeys: ['astara'], name: 'Astara Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'gran_senyiur', group: 'EXTENDED', matchKeys: ['senyiur'], name: 'Gran Senyiur Balikpapan', area: 'Jl. ARS Moh. No. 1-7', isOwn: false },
    { id: 'horison_ultima', group: 'EXTENDED', matchKeys: ['horison'], name: 'Horison Ultima Benua Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'penta_city', group: 'EXTENDED', matchKeys: ['penta'], name: 'Penta City Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'golden_tulip', group: 'EXTENDED', matchKeys: ['golden tulip'], name: 'Golden Tulip Balikpapan Hotel & Suites', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'dprima', group: 'EXTENDED', matchKeys: ['prima', 'dprima'], name: "D'Prima Hotel Balikpapan", area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'pacific', group: 'EXTENDED', matchKeys: ['pacific'], name: 'Pacific Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'sagita', group: 'EXTENDED', matchKeys: ['sagita'], name: 'Sagita Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'ibis', group: 'EXTENDED', matchKeys: ['ibis'], name: 'ibis Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false },
    { id: 'quest', group: 'EXTENDED', matchKeys: ['quest'], name: 'Quest Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'neo_plus', group: 'EXTENDED', matchKeys: ['neo+', 'neo plus', 'hotel neo', ' neo '], name: 'Hotel NEO+ Balikpapan', area: 'Jl. Podomoro / MT Haryono', isOwn: false },
    { id: 'zurich', group: 'EXTENDED', matchKeys: ['zurich'], name: 'Zurich Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'swissbel_inn', group: 'EXTENDED', matchKeys: ['swiss-belinn', 'swiss belinn', 'belinn'], name: 'Swiss-Belinn Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'max_one', group: 'EXTENDED', matchKeys: ['maxone', 'max one'], name: 'MaxOneHotels at Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'whiz', group: 'EXTENDED', matchKeys: ['whiz'], name: 'Whiz Prime Hotel Balikpapan', area: 'Jl. Jenderal Sudirman', isOwn: false }
  ];

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'SERPAPI_KEY belum diatur di Environment Variables Vercel.' });
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
    const openCompetitors = competitors.filter((h) => h.status === 'AVAILABLE' && Number(h.lowest_rate) > 0);
    const soldOutCompCount = Math.max(0, competitors.length - openCompetitors.length);
    const marketAvg = openCompetitors.length > 0
      ? Math.round(openCompetitors.reduce((s, x) => s + Number(x.lowest_rate), 0) / openCompetitors.length)
      : 0;
    const recommendedBar = marketAvg > 0
      ? Math.round((marketAvg + soldOutCompCount * 10000) / 5000) * 5000
      : 0;

    const timeWita = new Date(fetchedAt).toLocaleTimeString('id-ID', {
      timeZone: 'Asia/Makassar',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }) + ' WITA';

    const logPayload = {
      id: Date.now(),
      time: timeWita,
      checkin: checkinDate,
      ownStatus: (ownHotel?.status === 'AVAILABLE' && Number(ownHotel?.lowest_rate) > 0) ? 'AVAILABLE' : 'SOLD_OUT',
      ownLowest: Number(ownHotel?.lowest_rate) || 0,
      marketAvg,
      recommendedBar,
      openCount: openCompetitors.length,
      totalComp: competitors.length,
      alertSummary: soldOutCompCount >= 3 ? `${soldOutCompCount} kompetitor Sold Out` : 'Normal Parity'
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

      if (!found || !bestPrice) {
        return {
          ...item,
          status: 'SOLD_OUT',
          lowest_rate: 0,
          lowest_source: '',
          ota_breakdown: ota,
          all_ota_rates: []
        };
      }

      if (!(ota.traveloka || ota.tiket || ota.agoda || ota.booking) && bestPrice > 0 && bestSource) {
        const sLow = bestSource.toLowerCase();
        if (sLow.includes('traveloka')) ota.traveloka = bestPrice;
        else if (sLow.includes('tiket')) ota.tiket = bestPrice;
        else if (sLow.includes('agoda')) ota.agoda = bestPrice;
        else if (sLow.includes('booking')) ota.booking = bestPrice;
      }

      return {
        ...item,
        status: 'AVAILABLE',
        lowest_rate: bestPrice,
        lowest_source: bestSource || (allOtaRates[0]?.source || 'OTA'),
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
