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
    { id: 'platinum', matchKey: 'platinum', name: 'Platinum Hotel & Convention Hall Balikpapan', area: 'Jl. Soekarno Hatta, Balikpapan', isOwn: true },
    { id: 'swissbel', matchKey: 'swiss-belhotel', name: 'Swiss-Belhotel Balikpapan', area: 'Balikpapan Ocean Square (BOS)', isOwn: false },
    { id: 'fourpoints', matchKey: 'four points', name: 'Four Points by Sheraton Balikpapan', area: 'Sepinggan / Airport Corridor', isOwn: false },
    { id: 'aston', matchKey: 'aston', name: 'ASTON Balikpapan Hotel & Residence', area: 'Jl. Jenderal Sudirman', isOwn: false },
    { id: 'bluesky', matchKey: 'blue sky', name: 'Blue Sky Hotel Balikpapan', area: 'Kebun Sayur', isOwn: false },
    { id: 'novotel', matchKey: 'novotel', name: 'Novotel Balikpapan', area: 'Jl. Brigjen Ery Suparjan', isOwn: false }
  ];

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'SERPAPI_KEY belum diatur di Environment Variables Vercel.'
    });
  }

  function extractPrice(obj) {
    if (!obj) return 0;
    if (obj.rate_per_night?.extracted_lowest) return Number(obj.rate_per_night.extracted_lowest);
    if (obj.extracted_lowest) return Number(obj.extracted_lowest);
    if (obj.price) {
      const num = Number(String(obj.price).replace(/[^0-9]/g, ''));
      return Number.isFinite(num) ? num : 0;
    }
    return 0;
  }

  try {
    const queryUrl = `https://serpapi.com/search.json?engine=google_hotels&q=4+star+hotels+in+Balikpapan&check_in_date=${checkin}&check_out_date=${checkout}&currency=IDR&gl=id&hl=id&api_key=${apiKey}`;
    const response = await fetch(queryUrl);
    const json = await response.json();

    if (json.error) {
      return res.status(502).json({ error: json.error });
    }

    const props = json.properties || [];

    const hotels = tracked.map(item => {
      const found = props.find(p => (p.name || '').toLowerCase().includes(item.matchKey));
      const baseLowest = extractPrice(found?.rate_per_night);

      const rawOffers = [
        ...(Array.isArray(found?.featured_prices) ? found.featured_prices : []),
        ...(Array.isArray(found?.prices) ? found.prices : [])
      ];

      const ota = {};
      const otherSources = [];
      let bestPrice = baseLowest;
      let bestSource = found?.rate_per_night?.source || '';

      rawOffers.forEach(offer => {
        const srcName = String(offer?.source || '').trim();
        const srcLower = srcName.toLowerCase();
        const val = extractPrice(offer);
        if (!val || val <= 0) return;

        if (!bestPrice || val < bestPrice) {
          bestPrice = val;
          if (srcName) bestSource = srcName;
        }

        const isOfficialHotel = srcLower.includes('official') || srcLower.includes('platinum') || srcLower.includes('site');

        if (srcLower.includes('traveloka')) {
          if (!ota.traveloka || val < ota.traveloka) ota.traveloka = val;
        } else if (srcLower.includes('tiket')) {
          if (!ota.tiket || val < ota.tiket) ota.tiket = val;
        } else if (srcLower.includes('agoda')) {
          if (!ota.agoda || val < ota.agoda) ota.agoda = val;
        } else if (srcLower.includes('booking')) {
          if (!ota.booking || val < ota.booking) ota.booking = val;
        } else if (srcName && !isOfficialHotel) {
          otherSources.push(`${srcName}: ${val.toLocaleString('id-ID')}`);
        }
      });

      if (!found || !bestPrice || bestPrice <= 0) {
        return {
          ...item,
          status: 'SOLD_OUT',
          lowest_rate: 0,
          lowest_source: '',
          other_sources: [],
          ota_breakdown: {}
        };
      }

      // Jika kolom OTA tertentu kosong tapi ada harga terendah + sumber lain, isi agar terlihat informatif
      if (!bestSource && otherSources.length > 0) {
        bestSource = otherSources[0].split(':')[0];
      }

      return {
        ...item,
        status: 'AVAILABLE',
        lowest_rate: bestPrice,
        lowest_source: bestSource,
        other_sources: otherSources.slice(0, 3),
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
    return res.status(500).json({ error: err.message });
  }
}
