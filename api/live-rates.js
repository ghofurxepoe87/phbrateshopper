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
      const lowest = found?.rate_per_night?.extracted_lowest || 0;

      if (!found || !lowest) {
        return {
          ...item,
          status: 'SOLD_OUT',
          lowest_rate: 0,
          ota_breakdown: {}
        };
      }

      const ota = {};
      (found.prices || []).forEach(p => {
        const src = (p.source || '').toLowerCase();
        const val = p.rate_per_night?.extracted_lowest || 0;
        if (src.includes('traveloka')) ota.traveloka = val;
        if (src.includes('tiket')) ota.tiket = val;
        if (src.includes('agoda')) ota.agoda = val;
        if (src.includes('booking')) ota.booking = val;
      });

      return {
        ...item,
        status: 'AVAILABLE',
        lowest_rate: lowest,
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
