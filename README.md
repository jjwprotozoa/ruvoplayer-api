# RuvoPlayer API

IPTVnator-compatible proxy API for the [RuvoPlayer](https://github.com/jjwprotozoa/ruvoplayer) PWA.

## Endpoints

- `GET /health`
- `POST /provider-targets` with `{ "url": "<provider-url>" }`
- `GET /parse?targetId=<id>`
- `GET /xtream?targetId=<id>&username=<u>&password=<p>&action=<action>`
- `GET /stalker?targetId=<id>&macAddress=<mac>&action=<action>`

Production URL: https://ruvoplayer-api.vercel.app

Backup URL: https://ruvoplayer-api-backup.vercel.app

## Local development

```bash
npm install
CLIENT_URL=http://localhost:4200 npm run dev
```

## Vercel environment variables

- `CLIENT_URL` — allowed browser origins, comma-separated (example: `http://localhost:4200,https://ruvoplayer.vercel.app`)
- `IPTVNATOR_PROXY_ALLOW_PRIVATE_NETWORKS=1` — optional, for LAN/local playlist URLs during development
- `IPTVNATOR_ALLOW_INSECURE_TLS=1` — optional, for providers with self-signed certificates
