// /api/carrier.js - FMCSA QCMobile proxy (Vercel serverless function).
// The API key NEVER ships to the browser; it lives in the FMCSA_WEBKEY env var.
// Frontend calls:  /api/carrier?q=498282   (MC or USDOT number)
//                  /api/carrier?dot=1075604 (force USDOT lookup)
// NOTE: FMCSA_WEBKEY env var is preferred. The fallback below makes the lookup work
// without configuring Vercel - but it is a low-sensitivity public-data key committed to a
// public repo, so ROTATE it (or move it to a Vercel env var and delete this fallback).
const FMCSA_FALLBACK = '4fc2c90bc3bfaf3fc5a30fbe54dc5c1f24758563';

export default async function handler(req, res) {
  const key = process.env.FMCSA_WEBKEY || FMCSA_FALLBACK;
  const raw = (req.query.q || req.query.mc || req.query.dot || '').toString();
  const q = raw.replace(/[^0-9]/g, '');
  if (!key) return res.status(500).json({ ok: false, error: 'FMCSA key not configured on the server.' });
  if (!q) return res.status(400).json({ ok: false, error: 'Provide ?q=<MC or USDOT number>.' });

  const base = 'https://mobile.fmcsa.dot.gov/qc/services/carriers';
  // If the caller said it's a DOT, look up by DOT only. Otherwise try MC (docket) then DOT.
  const urls = req.query.dot
    ? [`${base}/${q}?webKey=${key}`]
    : [`${base}/docket-number/${q}?webKey=${key}`, `${base}/${q}?webKey=${key}`];

  try {
    for (const url of urls) {
      const r = await fetch(url, { headers: { accept: 'application/json' } });
      if (!r.ok) continue;
      const j = await r.json().catch(() => null);
      if (!j) continue;
      let c = j.content;
      if (Array.isArray(c)) c = c[0] && c[0].carrier;
      else if (c && c.carrier) c = c.carrier;
      if (c && (c.legalName || c.dbaName)) {
        res.setHeader('Cache-Control', 's-maxage=86400, stale-while-revalidate=43200');
        return res.status(200).json({
          ok: true,
          carrier: {
            legalName: c.legalName || c.dbaName || null,
            dba: c.dbaName || null,
            city: c.phyCity || null,
            state: c.phyState || null,
            powerUnits: (c.totalPowerUnits ?? null),
            drivers: (c.totalDrivers ?? null),
            allowedToOperate: c.allowedToOperate || null,
            dot: c.dotNumber || null,
          },
        });
      }
    }
    return res.status(404).json({ ok: false, error: 'No carrier found for that number.' });
  } catch (e) {
    return res.status(502).json({ ok: false, error: 'FMCSA lookup is temporarily unavailable.' });
  }
}
