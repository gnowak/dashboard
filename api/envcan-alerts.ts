// api/envcan-alerts.ts
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { XMLParser } from 'fast-xml-parser';

const REGION_DEFAULT = 'on61'; // City of Toronto region code

export default async function handler(req: VercelRequest, res: VercelResponse) {
  try {
    const region = (req.query.region as string) || REGION_DEFAULT; // ex: on61
    const url = `https://weather.gc.ca/rss/battleboard/${region}_e.xml`;

    const r = await fetch(url, { headers: { 'User-Agent': 'GeoffDash/1.0 (envcan-alerts)' } });
    if (!r.ok) throw new Error(`EnvCan fetch failed: ${r.status} ${r.statusText}`);
    const xml = await r.text();

    const parser = new XMLParser({ ignoreAttributes: false, attributeNamePrefix: '' });
    const feed = parser.parse(xml);

    const rawEntries = feed?.feed?.entry;
    const entries = (Array.isArray(rawEntries) ? rawEntries : rawEntries ? [rawEntries] : []).map((e: any) => ({
      id: e.id || e.link?.href || e.updated,
      title: (e.title || '').toString().trim(),
      updatedISO: e.updated || e.published || null,
      summary: (typeof e.summary === 'string' ? e.summary : e.summary?.['#text'])?.trim() || '',
      link: e.link?.href || null,
    }));

    res.setHeader('Cache-Control', 's-maxage=120, stale-while-revalidate=600');
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(200).json({ region, entries });
  } catch (err: any) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.status(500).json({ error: err?.message ?? 'failed' });
  }
}

export const config = { runtime: 'nodejs18.x' } as const;
