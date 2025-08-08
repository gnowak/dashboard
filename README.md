# Geoff Dashboard – Add-on Kit

This bundle gives you:
- `api/envcan-alerts.ts` — Environment Canada Toronto ATOM → JSON
- `api/ttc-alerts.ts` — TTC GTFS-RT Alerts → JSON
- `index-boot-dark-snippet.html` — optional no-flash dark boot script
- `tailwind-dark-config.diff` — tiny patch if you need `darkMode: ["class"]`
- `.env.example` — convenience env vars for your endpoints

## Install

```bash
npm i fast-xml-parser gtfs-realtime-bindings
```

For TypeScript projects, ensure `skipLibCheck: true` or add `@types/node`.

## Wire the endpoints

- If you use Vercel, placing these under `/api` will Just Work™ as serverless functions.
- Locally (Vite), you can proxy `/api/*` to a local server or run `vercel dev`.

Your dashboard expects:

```ts
TTC_ALERTS_ENDPOINT = '/api/ttc-alerts'
ENV_CAN_ALERTS_ENDPOINT = '/api/envcan-alerts'
```

## Prevent white flash on load (optional)

Paste the contents of `index-boot-dark-snippet.html` into your `<head>` before the bundle.

## Tailwind dark mode

If you haven’t already set this, apply `tailwind-dark-config.diff` or just ensure:

```js
// tailwind.config.js
export default {
  darkMode: ["class"],
  // ...
}
```

## Env vars

Copy `.env.example` to `.env.local` and tweak as needed.
