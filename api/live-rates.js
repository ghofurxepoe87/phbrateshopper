export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const checkin = req.query.checkin || new Date(Date.now() + 86400000).toISOString().split('T')[0];
  const checkout = new Date(new Date(checkin).getTime() + 86400000).toISOString().split('T')[0];

  const tracked = [
    { id: 'platinum', matchKeys: ['platinum hotel', 'platinum'], name: 'Platinum Hotel & Convention Hall Balikpapan', area: 'Jl. Soekarno Hatta, Balikpapan', isOwn: true },
    { id: 'swissbel', matchKeys: ['swiss-belhotel', 'swiss belhotel'], name: 'Swiss-Belhotel Balikpapan', area: 'Balikpapan Ocean Square (BOS)', isOwn: false },
    { id: 'fourpoints', matchKeys: ['four points', 'sheraton'], name: 'Four Points by Sheraton Balikpapan', area: 'Sepinggan / Airport Corridor', isOwn: false },
    { id: 'aston', matchKeys: ['aston balikpapan', 'aston'], name: 'ASTON Balikpapan Hotel & Residence', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'bluesky', matchKeys: ['blue sky'], name: 'Blue Sky Hotel Balikpapan', area: 'Kebun Sayur', isOwn: false },
    { id: 'novotel', matchKeys: ['novotel'], name: 'Novotel Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false }
  ];

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(400).json({ error: 'SERPAPI_KEY belum diatur di Environment Variables Vercel.' });
  }

  const toNum = (v) => {
    if (typeof v === 'number') return v > 0 ? v : 0;
    const n = Number(String(v || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  try {
    const url = `https://serpapi.com/search.json?engine=google_hotels&q=hotels+in+Balikpapan&check_in_date=${checkin}&check_out_date=${checkout}&currency=IDR&gl=id&hl=id&api_key=${encodeURIComponent(apiKey)}`;
    const response = await fetch(url);
    const json = await response.json();

    if (json.error) {
      return res.status(502).json({ error: String(json.error) });
    }

    const props = Array.isArray(json.properties) ? json.properties : [];

    const hotels = tracked.map((item) => {
      const found = props.find((p) => {
        const title = String(p && p.name ? p.name : '').toLowerCase();
        return item.matchKeys.some((k) => title.includes(k));
      });

      const basePrice = toNum(found && found.rate_per_night && (found.rate_per_night.extracted_lowest || found.rate_per_night.lowest));
      const offers = [
        ...(Array.isArray(found && found.featured_prices) ? found.featured_prices : []),
        ...(Array.isArray(found && found.prices) ? found.prices : [])
      ];

      const ota = {};
      const sources = [];
      let bestPrice = basePrice;
      let bestSource = String((found && found.rate_per_night && found.rate_per_night.source) || '').trim();

      for (const offer of offers) {
        if (!offer) continue;
        const src = String(offer.source || '').trim();
        const lowSrc = src.toLowerCase();
        const val = toNum(
          (offer.rate_per_night && (offer.rate_per_night.extracted_lowest || offer.rate_per_night.lowest)) ||
          offer.extracted_lowest ||
          offer.lowest ||
          offer.price
        );
        if (!val) continue;

        if (!bestPrice || val < bestPrice) {
          bestPrice = val;
          if (src) bestSource = src;
        }

        if (lowSrc.includes('traveloka')) {
          if (!ota.traveloka || val < ota.traveloka) ota.traveloka = val;
        } else if (lowSrc.includes('tiket')) {
          if (!ota.tiket || val < ota.tiket) ota.tiket = val;
        } else if (lowSrc.includes('agoda')) {
          if (!ota.agoda || val < ota.agoda) ota.agoda = val;
        } else if (lowSrc.includes('booking')) {
          if (!ota.booking || val < ota.booking) ota.booking = val;
        } else if (src) {
          sources.push(`${src}: ${val.toLocaleString('id-ID')}`);
        }
      }

      if (!found || !bestPrice) {
        return {
          ...item,
          status: 'SOLD_OUT',
          lowest_rate: 0,
          lowest_source: '',
          other_sources: [],
          ota_breakdown: {}
        };
      }

      return {
        ...item,
        status: 'AVAILABLE',
        lowest_rate: bestPrice,
        lowest_source: bestSource || 'Google Hotels',
        other_sources: Array.from(new Set(sources)).slice(0, 3),
        ota_breakdown: ota
      };
    });

    return res.status(200).json({
      checkin,
      checkout,
      fetched_at: new Date().toISOString(),
      hotels
    });
  } catch (err) {
    return res.status(500).json({ error: err && err.message ? err.message : 'Server error' });
  }
}
