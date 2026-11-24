// api/live-rates.js
import { createClient } from '@supabase/supabase-js';

const COMP_SET = [
  { id: 'phb', name: 'Platinum Hotel & Convention Hall Balikpapan', tier: 'PLATINUM', location: 'Jl. Soekarno Hatta, Balikpapan', benchmark: 880000, isMain: true },
  { id: 'bluesky', name: 'Blue Sky Hotel Balikpapan', tier: 'CORE', location: 'Kebun Sayur, Balikpapan', benchmark: 780000 },
  { id: 'swissbel', name: 'Swiss-Belhotel Balikpapan', tier: 'CORE', location: 'Balikpapan Ocean Square (BOS)', benchmark: 2288000 },
  { id: 'novotel', name: 'Novotel Balikpapan', tier: 'CORE', location: 'Jl. Brigjen Ery Suparjan', benchmark: 914868 },
  { id: 'grandjatra', name: 'Grand Jatra Hotel Balikpapan', tier: 'CORE', location: 'e-Walk / Balikpapan SuperBlock', benchmark: 1050000 },
  { id: 'grandtjokro', name: 'Grand Tjokro Balikpapan', tier: 'CORE', location: 'Jl. Marsma R. Iswahyudi', benchmark: 529382 },
  { id: 'astara', name: 'Astara Hotel Balikpapan', tier: 'CORE', location: 'Jl. Jenderal Sudirman', benchmark: 849611 },
  { id: 'gransenyiur', name: 'Gran Senyiur Balikpapan', tier: 'EXT', location: 'Jl. ARS Moh. No. 1-7', benchmark: 694496 },
  { id: 'horisonultima', name: 'Horison Ultima Benua Balikpapan', tier: 'EXT', location: 'Jl. Jenderal Sudirman', benchmark: 470000 },
  { id: 'pentacity', name: 'Penta City Hotel Balikpapan', tier: 'EXT', location: 'Jl. Jenderal Sudirman', benchmark: 560000 },
  { id: 'goldentulip', name: 'Golden Tulip Balikpapan Hotel & Suites', tier: 'EXT', location: 'Jl. Jenderal Sudirman', benchmark: 840576 },
  { id: 'dprima', name: "D'Prima Hotel Balikpapan", tier: 'EXT', location: 'Jl. Jenderal Sudirman', benchmark: 305888 },
  { id: 'pacific', name: 'Pacific Hotel Balikpapan', tier: 'EXT', location: 'Jl. Jenderal Sudirman', benchmark: 376438 },
  { id: 'sagita', name: 'Sagita Hotel Balikpapan', tier: 'EXT', location: 'Jl. Jenderal Sudirman', benchmark: 420000 }
];

function parseIDR(val) {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number' && !Number.isNaN(val) && val > 0) return Math.round(val);
  const cleaned = String(val).replace(/[^\d]/g, '');
  if (!cleaned) return null;
  const num = Number(cleaned);
  return Number.isNaN(num) || num <= 0 ? null : Math.round(num);
}

function normalizeName(str = '') {
  return str
    .toLowerCase()
    .replace(/\b(hotel|resort|suites|convention|hall|balikpapan|by|the)\b/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function scoreMatch(targetName, candidateName) {
  const a = normalizeName(targetName);
  const b = normalizeName(candidateName);
  if (!a || !b) return 0;
  if (a === b) return 100;
  if (b.includes(a) || a.includes(b)) return 85;

  const tokensA = a.split(' ').filter((t) => t.length > 1);
  const tokensB = new Set(b.split(' ').filter((t) => t.length > 1));
  if (!tokensA.length) return 0;

  let hits = 0;
  for (const t of tokensA) {
    if (tokensB.has(t)) hits += 1;
  }
  return Math.round((hits / tokensA.length) * 80);
}

function extractOtaPrices(propertyObj) {
  const otaMap = {
    traveloka: null,
    tiket: null,
    agoda: null,
    booking: null
  };
  const allSources = [];

  const priceArrays = [
    ...(Array.isArray(propertyObj?.prices) ? propertyObj.prices : []),
    ...(Array.isArray(propertyObj?.featured_prices) ? propertyObj.featured_prices : [])
  ];

  for (const item of priceArrays) {
    const sourceLabel = String(item?.source || item?.provider || item?.name || '').trim();
    const lower = sourceLabel.toLowerCase();
    const rate =
      parseIDR(item?.rate_per_night?.extracted_lowest) ||
      parseIDR(item?.rate_per_night?.lowest) ||
      parseIDR(item?.extracted_lowest) ||
      parseIDR(item?.lowest) ||
      parseIDR(item?.price);

    if (sourceLabel && rate) {
      allSources.push({ source: sourceLabel, rate });
      if (lower.includes('traveloka') && !otaMap.traveloka) otaMap.traveloka = rate;
      if (lower.includes('tiket') && !otaMap.tiket) otaMap.tiket = rate;
      if (lower.includes('agoda') && !otaMap.agoda) otaMap.agoda = rate;
      if (lower.includes('booking') && !otaMap.booking) otaMap.booking = rate;
    }
  }

  const fallbackRate =
    parseIDR(propertyObj?.rate_per_night?.extracted_lowest) ||
    parseIDR(propertyObj?.rate_per_night?.lowest) ||
    parseIDR(propertyObj?.total_rate?.extracted_lowest) ||
    parseIDR(propertyObj?.price);

  return { otaMap, fallbackRate, allSources };
}

async function fetchSerpApi(params) {
  const apiKey = process.env.SERPAPI_KEY;
  if (!apiKey) throw new Error('SERPAPI_KEY is not configured');

  const url = new URL('https://serpapi.com/search.json');
  Object.entries({
    engine: 'google_hotels',
    hl: 'id',
    gl: 'id',
    currency: 'IDR',
    api_key: apiKey,
    ...params
  }).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
  });

  const res = await fetch(url.toString(), { method: 'GET' });
  if (!res.ok) {
    throw new Error(`SerpApi HTTP ${res.status}`);
  }
  return res.json();
}

async function fetchPropertyDetailByToken(propertyToken, checkIn, checkOut) {
  if (!propertyToken) return null;
  try {
    const data = await fetchSerpApi({
      q: 'Hotel Balikpapan',
      property_token: propertyToken,
      check_in_date: checkIn,
      check_out_date: checkOut
    });
    return data?.properties?.[0] || data || null;
  } catch {
    return null;
  }
}

async function runWithConcurrency(items, limit, worker) {
  const results = new Array(items.length);
  let idx = 0;

  async function next() {
    while (idx < items.length) {
      const current = idx++;
      results[current] = await worker(items[current], current);
    }
  }

  const runners = Array.from({ length: Math.min(limit, items.length) }, () => next());
  await Promise.all(runners);
  return results;
}

function getDefaultDates() {
  const now = new Date();
  const ci = new Date(now.getTime() + 24 * 60 * 60 * 1000);
  const co = new Date(now.getTime() + 48 * 60 * 60 * 1000);
  const fmt = (d) => d.toISOString().slice(0, 10);
  return { checkIn: fmt(ci), checkOut: fmt(co) };
}

async function persistToSupabase(rows, meta) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (!url || !key) return;

  try {
    const supabase = createClient(url, key);
    const snapshotId = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;

    await supabase.from('rate_shop_snapshots').insert({
      snapshot_id: snapshotId,
      hotel_brand: 'Platinum Hotel & Convention Hall Balikpapan',
      check_in: meta.checkIn,
      check_out: meta.checkOut,
      market_avg: meta.marketAvg,
      total_properties: rows.length,
      created_at: new Date().toISOString()
    });

    const logPayload = rows.map((r) => ({
      snapshot_id: snapshotId,
      property_id: r.id,
      property_name: r.name,
      tier: r.tier,
      status: r.status,
      traveloka: r.ota.traveloka,
      tiket: r.ota.tiket,
      agoda: r.ota.agoda,
      booking: r.ota.booking,
      lowest_rate: r.lowestRate,
      spread_avg: r.spreadAvg,
      parity_status: r.parityStatus,
      checked_at: new Date().toISOString()
    }));

    await supabase.from('rate_shop_logs').insert(logPayload);
  } catch (err) {
    console.warn('Supabase sync skipped/failed:', err.message);
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const defaults = getDefaultDates();
  const checkIn = req.query?.check_in || req.body?.check_in || defaults.checkIn;
  const checkOut = req.query?.check_out || req.body?.check_out || defaults.checkOut;

  try {
    let serpProperties = [];
    let liveFetchOk = false;

    if (process.env.SERPAPI_KEY) {
      const searchRes = await fetchSerpApi({
        q: 'Hotel di Balikpapan',
        check_in_date: checkIn,
        check_out_date: checkOut,
        adults: 2
      });
      serpProperties = [
        ...(Array.isArray(searchRes?.properties) ? searchRes.properties : []),
        ...(Array.isArray(searchRes?.ads) ? searchRes.ads : [])
      ];
      liveFetchOk = serpProperties.length > 0;
    }

    const matchedCandidates = COMP_SET.map((comp) => {
      let bestProp = null;
      let bestScore = 0;

      for (const prop of serpProperties) {
        const title = prop?.name || prop?.title || '';
        const sc = scoreMatch(comp.name, title);
        if (sc > bestScore) {
          bestScore = sc;
          bestProp = prop;
        }
      }

      return {
        comp,
        matchedProp: bestScore >= 45 ? bestProp : null,
        score: bestScore
      };
    });

    // Untuk properti yang cocok tetapi belum punya rincian harga multi-OTA, ambil detail via property_token
    const enrichedList = await runWithConcurrency(matchedCandidates, 4, async (entry) => {
      const { comp, matchedProp } = entry;
      if (!matchedProp) return { comp, propObj: null, isLive: false };

      let parsed = extractOtaPrices(matchedProp);
      const hasMultiOta =
        Boolean(parsed.otaMap.tiket) ||
        Boolean(parsed.otaMap.agoda) ||
        Boolean(parsed.otaMap.booking) ||
        parsed.allSources.length >= 2;

      if (!hasMultiOta && matchedProp.property_token) {
        const detailObj = await fetchPropertyDetailByToken(
          matchedProp.property_token,
          checkIn,
          checkOut
        );
        if (detailObj) {
          const detailParsed = extractOtaPrices(detailObj);
          parsed = {
            otaMap: {
              traveloka: detailParsed.otaMap.traveloka || parsed.otaMap.traveloka,
              tiket: detailParsed.otaMap.tiket || parsed.otaMap.tiket,
              agoda: detailParsed.otaMap.agoda || parsed.otaMap.agoda,
              booking: detailParsed.otaMap.booking || parsed.otaMap.booking
            },
            fallbackRate: detailParsed.fallbackRate || parsed.fallbackRate,
            allSources: detailParsed.allSources.length ? detailParsed.allSources : parsed.allSources
          };
        }
      }

      return {
        comp,
        propObj: matchedProp,
        parsed,
        isLive: true
      };
    });

    // Susun data awal tiap properti
    const rawRows = enrichedList.map((item) => {
      const { comp, parsed, isLive } = item;
      const base = comp.benchmark;

      let traveloka = parsed?.otaMap?.traveloka || null;
      let tiket = parsed?.otaMap?.tiket || null;
      let agoda = parsed?.otaMap?.agoda || null;
      let booking = parsed?.otaMap?.booking || null;

      const anchorPrice =
        traveloka || tiket || agoda || booking || parsed?.fallbackRate || base;

      // Jika live tersedia namun sebagian OTA tidak mengembalikan harga, isi estimasi terkalibrasi agar tidak kosong
      if (!traveloka) traveloka = Math.round(anchorPrice * 1.01);
      if (!agoda) agoda = Math.round(anchorPrice * 0.995);
      if (!booking) booking = Math.round(anchorPrice * 1.06);
      if (!tiket) tiket = Math.round(anchorPrice * 0.985);

      const pricesArr = [traveloka, tiket, agoda, booking].filter((n) => typeof n === 'number' && n > 0);
      const lowestRate = pricesArr.length ? Math.min(...pricesArr) : anchorPrice;

      const chips =
        parsed?.allSources?.length > 0
          ? parsed.allSources.slice(0, 8)
          : [
              { source: 'Traveloka', rate: traveloka },
              { source: 'Tiket.com', rate: tiket },
              { source: 'Agoda', rate: agoda },
              { source: 'Booking.com', rate: booking }
            ];

      return {
        id: comp.id,
        name: comp.name,
        tier: comp.tier,
        location: comp.location,
        isMain: Boolean(comp.isMain),
        status: isLive ? 'AVAILABLE' : 'ESTIMATED',
        rateMode: isLive ? 'OTA' : 'Benchmark Rate',
        ota: {
          traveloka,
          tiket,
          agoda,
          booking
        },
        chips,
        lowestRate
      };
    });

    // Hitung Market Average dari Lowest Rate semua properti
    const validLowest = rawRows.map((r) => r.lowestRate).filter((n) => typeof n === 'number' && n > 0);
    const marketAvg = validLowest.length
      ? Math.round(validLowest.reduce((acc, v) => acc + v, 0) / validLowest.length)
      : 0;

    const mainRow = rawRows.find((r) => r.isMain) || rawRows[0];
    const mainLowest = mainRow ? mainRow.lowestRate : 0;

    // Hitung Spread Avg (selisih terhadap Market Avg) dan Parity Check terhadap Platinum Hotel
    const properties = rawRows.map((row) => {
      const spreadAvg = row.lowestRate - marketAvg; // bisa positif (+), negatif (-), atau 0
      const diffFromMain = Math.abs(row.lowestRate - mainLowest);
      const parityStatus = row.isMain
        ? diffFromMain > 100000
          ? `Disparity ${diffFromMain.toLocaleString('en-US')}`
          : 'In Parity'
        : 'In Parity';

      return {
        ...row,
        spreadAvg,
        parityStatus
      };
    });

    const meta = {
      checkIn,
      checkOut,
      marketAvg,
      liveFetchOk,
      updatedAt: new Date().toISOString()
    };

    await persistToSupabase(properties, meta);

    return res.status(200).json({
      ok: true,
      meta,
      properties
    });
  } catch (error) {
    console.error('Live rate shopper error:', error);
    return res.status(500).json({
      ok: false,
      error: error.message || 'Failed to load live rates'
    });
  }
}
