// api/ttc-alerts.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import * as GtfsRealtimeBindings from 'gtfs-realtime-bindings';

const TTC_ALERTS_FEED = 'https://bustime.ttc.ca/gtfsrt/alerts';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const resp = await fetch(TTC_ALERTS_FEED, { headers: { 'User-Agent': 'GeoffDash/1.0 (ttc-alerts)' } });
    if (!resp.ok) throw new Error(`TTC alerts fetch failed: ${resp.status} ${resp.statusText}`);

    const buf = Buffer.from(await resp.arrayBuffer());
    const feed = GtfsRealtimeBindings.transit_realtime.FeedMessage.decode(buf);

    const alerts = (feed.entity || [])
      .filter((e: any) => e.alert)
      .map((e: any) => {
        const a = e.alert;
        const pickText = (tx: any) => (tx?.translation?.[0]?.text ? String(tx.translation[0].text) : undefined);
        return {
          id: e.id,
          header: pickText(a.headerText) || null,
          description: pickText(a.descriptionText) || null,
          url: pickText(a.url) || null,
          cause: a.cause ?? null,
          effect: a.effect ?? null,
          severity: a.severity ?? null,
          activePeriods: (a.activePeriod || []).map((p: any) => ({
            start: p.start ? new Date(Number(p.start) * 1000).toISOString() : null,
            end: p.end ? new Date(Number(p.end) * 1000).toISOString() : null,
          })),
          informed: (a.informedEntity || []).map((ie: any) => ({
            routeId: ie.routeId ?? null,
            stopId: ie.stopId ?? null,
            tripId: ie.trip?.tripId ?? null,
          })),
        };
      });

    res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ source: 'bustime.ttc.ca', count: alerts.length, alerts });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: err?.message ?? 'failed' });
  }
}

export const config = { runtime: 'nodejs18.x' } as const;
