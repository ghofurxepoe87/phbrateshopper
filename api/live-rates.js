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
    // Properti Utama
    {
      id: 'platinum',
      group: 'CORE',
      matchKeys: ['platinum hotel', 'platinum balikpapan', 'platinum'],
      name: 'Platinum Hotel & Convention Hall Balikpapan',
      area: 'Jl. Soekarno Hatta, Balikpapan',
      isOwn: true
    },
    // Grup Utama (Atas SUB TOTAL)
    {
      id: 'bluesky',
      group: 'CORE',
      matchKeys: ['blue sky'],
      name: 'Blue Sky Hotel Balikpapan',
      area: 'Kebun Sayur, Balikpapan',
      isOwn: false
    },
    {
      id: 'swissbel_balcony',
      group: 'CORE',
      matchKeys: ['swiss-belhotel balcony', 'swiss belhotel balcony', 'swiss-belhotel', 'swiss belhotel'],
      name: 'Swiss-Belhotel Balikpapan',
      area: 'Balikpapan Ocean Square (BOS)',
      isOwn: false
    },
    {
      id: 'novotel',
      group: 'CORE',
      matchKeys: ['novotel'],
      name: 'Novotel Balikpapan',
      area: 'Jl. Brigjen Ery Suparjan',
      isOwn: false
    },
    {
      id: 'grand_jatra',
      group: 'CORE',
      matchKeys: ['grand jatra', 'jatra'],
      name: 'Grand Jatra Hotel Balikpapan',
      area: 'e-Walk / Balikpapan SuperBlock',
      isOwn: false
    },
    {
      id: 'grand_tjokro',
      group: 'CORE',
      matchKeys: ['grand tjokro', 'tjokro'],
      name: 'Grand Tjokro Balikpapan',
      area: 'Jl. Marsma R. Iswahyudi',
      isOwn: false
    },
    {
      id: 'astara',
      group: 'CORE',
      matchKeys: ['astara'],
      name: 'Astara Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    // Grup Lanjutan (Bawah SUB TOTAL)
    {
      id: 'gran_senyiur',
      group: 'EXTENDED',
      matchKeys: ['gran senyiur', 'senyiur'],
      name: 'Gran Senyiur Balikpapan',
      area: 'Jl. ARS Moh. No. 1-7',
      isOwn: false
    },
    {
      id: 'horison_ultima',
      group: 'EXTENDED',
      matchKeys: ['horison ultima', 'horison'],
      name: 'Horison Ultima Benua Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'penta_city',
      group: 'EXTENDED',
      matchKeys: ['penta city', 'penta'],
      name: 'Penta City Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'golden_tulip',
      group: 'EXTENDED',
      matchKeys: ['golden tulip'],
      name: 'Golden Tulip Balikpapan Hotel & Suites',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'dprima',
      group: 'EXTENDED',
      matchKeys: ['d prima', 'dprima', 'd’prima', 'prima city'],
      name: "D'Prima Hotel Balikpapan",
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'pacific',
      group: 'EXTENDED',
      matchKeys: ['pacific'],
      name: 'Pacific Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'sagita',
      group: 'EXTENDED',
      matchKeys: ['sagita'],
      name: 'Sagita Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'ibis',
      group: 'EXTENDED',
      matchKeys: ['ibis balikpapan', 'ibis'],
      name: 'ibis Balikpapan',
      area: 'Jl. Brigjen Ery Suparjan',
      isOwn: false
    },
    {
      id: 'quest',
      group: 'EXTENDED',
      matchKeys: ['quest hotel', 'quest'],
      name: 'Quest Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'neo_plus',
      group: 'EXTENDED',
      matchKeys: ['neo+', 'neo plus', 'hotel neo'],
      name: 'Hotel NEO+ Balikpapan',
      area: 'Jl. Podomoro / MT Haryono',
      isOwn: false
    },
    {
      id: 'zurich',
      group: 'EXTENDED',
      matchKeys: ['zurich'],
      name: 'Zurich Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'swissbel_inn',
      group: 'EXTENDED',
      matchKeys: ['swiss-belinn', 'swiss belinn'],
      name: 'Swiss-Belinn Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'max_one',
      group: 'EXTENDED',
      matchKeys: ['maxone', 'max one'],
      name: 'MaxOneHotels at Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    },
    {
      id: 'whiz',
      group: 'EXTENDED',
      matchKeys: ['whiz prime', 'whiz hotel', 'whiz'],
      name: 'Whiz Prime Hotel Balikpapan',
      area: 'Jl. Jenderal Sudirman',
      isOwn: false
    }
  ];

  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) {
    return res.status(400).json({
      error: 'SERPAPI_KEY belum diatur di Environment Variables Vercel.'
    });
  }

  const toNum = (v) => {
    if (typeof v === 'number') return Number.isFinite(v) && v > 0 ? Math.round(v) : 0;
    const n = Number(String(v || '').replace(/[^0-9]/g, ''));
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  };

  const extractOfferPrice = (offer) => {
    if (!offer || typeof offer !== 'object') return 0;
    return (
      toNum(offer.rate_per_night?.extracted_lowest) ||
      toNum(offer.rate_per_night?.lowest) ||
      toNum(offer.extracted_lowest) ||
      toNum(offer.lowest) ||
      toNum(offer.price) ||
      0
    );
  };

  async function fetchPropertyDetail(propertyToken, propTitle) {
    if (!propertyToken) return null;
    try {
      const detailUrl =
        `https://serpapi.com/search.json?engine=google_hotels` +
        `&q=${encodeURIComponent(propTitle || 'Hotel Balikpapan')}` +
        `&property_token=${encodeURIComponent(propertyToken)}` +
        `&check_in_date=${checkin}&check_out_date=${checkout}` +
        `&currency=IDR&gl=id&hl=id&api_key=${encodeURIComponent(apiKey)}`;
      const r = await fetch(detailUrl);
      const d = await r.json();
      if (d && !d.error) return d;
      return null;
    } catch {
      return null;
    }
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

    // Hindari satu properti Google Hotels cocok ke dua entri berbeda
    const usedPropertyNames = new Set();
    const matchedEntries = tracked.map((item) => {
      const found = props.find((p) => {
        const rawName = String(p?.name || '').trim();
        if (!rawName || usedPropertyNames.has(rawName)) return false;
        const title = rawName.toLowerCase();
        return item.matchKeys.some((k) => title.includes(k));
      });
      if (found?.name) usedPropertyNames.add(String(found.name).trim());
      return { item, found };
    });

    // Tarik detail OTA untuk properti yang cocok (dibatasi 8 properti per request agar cepat & hemat kuota)
    let detailBudget = 8;
    const detailResults = await Promise.all(
      matchedEntries.map(({ found }) => {
        if (found?.property_token && detailBudget > 0) {
          detailBudget -= 1;
          return fetchPropertyDetail(found.property_token, found.name);
        }
        return Promise.resolve(null);
      })
    );

    const hotels = matchedEntries.map(({ item, found }, idx) => {
      const detail = detailResults[idx];

      const basePrice =
        toNum(detail?.rate_per_night?.extracted_lowest) ||
        toNum(detail?.rate_per_night?.lowest) ||
        toNum(found?.rate_per_night?.extracted_lowest) ||
        toNum(found?.rate_per_night?.lowest) ||
        0;

      const offers = [
        ...(Array.isArray(detail?.featured_prices) ? detail.featured_prices : []),
        ...(Array.isArray(detail?.prices) ? detail.prices : []),
        ...(Array.isArray(found?.featured_prices) ? found.featured_prices : []),
        ...(Array.isArray(found?.prices) ? found.prices : [])
      ];

      const ota = {
        traveloka: 0,
        tiket: 0,
        agoda: 0,
        booking: 0
      };

      const otaMap = new Map();
      let bestPrice = basePrice;
      let bestSource = String(
        detail?.rate_per_night?.source || found?.rate_per_night?.source || ''
      ).trim();

      for (const offer of offers) {
        if (!offer) continue;
        const src = String(offer.source || '').trim();
        const lowSrc = src.toLowerCase();
        const val = extractOfferPrice(offer);
        if (!val) continue;

        if (!bestPrice || val < bestPrice) {
          bestPrice = val;
          if (src) bestSource = src;
        }

        if (src) {
          const prev = otaMap.get(src);
          if (!prev || val < prev) {
            otaMap.set(src, val);
          }
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

      const hasAnyMainOta = Boolean(ota.traveloka || ota.tiket || ota.agoda || ota.booking);
      if (!hasAnyMainOta && bestPrice > 0 && bestSource) {
        const bLower = bestSource.toLowerCase();
        if (bLower.includes('traveloka')) ota.traveloka = bestPrice;
        else if (bLower.includes('tiket')) ota.tiket = bestPrice;
        else if (bLower.includes('agoda')) ota.agoda = bestPrice;
        else if (bLower.includes('booking')) ota.booking = bestPrice;
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

    return res.status(200).json({
      checkin,
      checkout,
      fetched_at: new Date().toISOString(),
      total_properties_found: props.length,
      hotels
    });
  } catch (err) {
    return res.status(500).json({ error: err?.message || 'Server error' });
  }
}
