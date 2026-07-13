import cors from 'cors';
import express from 'express';
import {
    createProviderTargetId,
    normalizeXtreamServerUrl,
    resolveProviderTargetId,
    validateProviderUrl,
} from './lib/provider-url.js';
import { parsePlaylistFromUrl } from './lib/playlist-service.js';
import { extractFetchError, httpClient } from './lib/http-client.js';
import { handleStreamProxy } from './lib/stream-proxy.js';

const app = express();

const corsMiddleware = cors({
    origin(origin, callback) {
        const allowedOrigins = getClientOrigins();
        if (
            !origin ||
            allowedOrigins.includes('*') ||
            allowedOrigins.includes(origin)
        ) {
            callback(null, true);
            return;
        }
        callback(null, false);
    },
    optionsSuccessStatus: 200,
});

app.get('/', (_req, res) => {
    res.json({
        status: 'ok',
        service: 'ruvoplayer-api',
        endpoints: {
            health: '/health',
            providerTargets: '/provider-targets',
            parse: '/parse?targetId=<id>',
            xtream: '/xtream?targetId=<id>&username=<u>&password=<p>&action=<action>',
            stalker: '/stalker?targetId=<id>&macAddress=<mac>&action=<action>',
            streamProxy: '/stream-proxy?url=<encoded-stream-url>',
        },
    });
});

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'ruvoplayer-api' });
});

app.options('/provider-targets', corsMiddleware);
app.post(
    '/provider-targets',
    corsMiddleware,
    express.json({ limit: '16kb' }),
    async (req, res) => {
        const rawUrl =
            req.body &&
            typeof req.body === 'object' &&
            typeof req.body.url === 'string'
                ? req.body.url
                : undefined;

        if (!rawUrl) {
            res.status(400).json({ message: 'Missing url', status: 400 });
            return;
        }

        const result = await validateProviderUrl(rawUrl);
        if ('message' in result) {
            res.status(result.status).json(result);
            return;
        }

        const targetId = createProviderTargetId(result);
        res.json({ targetId });
    }
);

app.get('/parse', corsMiddleware, async (req, res) => {
    const targetUrl = await getRegisteredProviderUrl(req, res);
    if (!targetUrl) {
        return;
    }

    const result = await parsePlaylistFromUrl(targetUrl.href);
    if (result.error) {
        console.error('[ruvoplayer-api] Playlist parse failed:', result.error);
        res.status(result.error.status).json(result.error);
        return;
    }

    res.json(result.playlist);
});

app.get('/xtream', corsMiddleware, async (req, res) => {
    const registeredUrl = await getRegisteredProviderUrl(req, res);
    if (!registeredUrl) {
        return;
    }

    const url = new URL(registeredUrl.href);

    try {
        url.href = normalizeXtreamServerUrl(url.href);
        const validated = await validateProviderUrl(
            appendPathSegment(url, 'player_api.php')
        );
        if ('message' in validated) {
            res.status(validated.status).json(validated);
            return;
        }

        const response = await httpClient.get(
            appendPathSegment(url, 'player_api.php'),
            {
                params: getProxyParams(req.query, ['targetId']),
            }
        );

        res.json({
            action: getQueryString(req.query, 'action'),
            payload: response.data,
        });
    } catch (error) {
        res.json(extractFetchError(error));
    }
});

app.get('/stalker', corsMiddleware, async (req, res) => {
    const targetUrl = await getRegisteredProviderUrl(req, res);
    if (!targetUrl) {
        return;
    }

    const macAddress = getQueryString(req.query, 'macAddress');
    const token = getQueryString(req.query, 'token');

    try {
        const response = await httpClient.get(targetUrl.href, {
            params: getProxyParams(req.query, ['targetId']),
            headers: {
                ...(macAddress ? { Cookie: `mac=${macAddress}` } : {}),
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        });

        res.json({
            action: getQueryString(req.query, 'action'),
            payload: response.data,
        });
    } catch (error) {
        res.json(extractFetchError(error));
    }
});

app.options('/stream-proxy', corsMiddleware);
app.head('/stream-proxy', corsMiddleware, async (req, res) => {
    await proxyStreamRequest(req, res);
});
app.get('/stream-proxy', corsMiddleware, async (req, res) => {
    await proxyStreamRequest(req, res);
});

async function proxyStreamRequest(req, res) {
    const streamUrl =
        getQueryString(req.query, 'url') ?? getQueryString(req.query, 'streamUrl');
    if (!streamUrl) {
        res.status(400).json({ message: 'Missing url parameter', status: 400 });
        return;
    }

    let targetUrl;
    try {
        targetUrl = new URL(streamUrl);
    } catch {
        res.status(400).json({ message: 'Invalid stream URL', status: 400 });
        return;
    }

    if (targetUrl.protocol !== 'http:' && targetUrl.protocol !== 'https:') {
        res.status(400).json({
            message: 'Only http and https stream URLs are supported',
            status: 400,
        });
        return;
    }

    const validationResult = await validateProviderUrl(streamUrl);
    if ('message' in validationResult) {
        res.status(validationResult.status).json(validationResult);
        return;
    }

    handleStreamProxy(req, res, targetUrl);
}

async function getRegisteredProviderUrl(req, res) {
    const targetId = getQueryString(req.query, 'targetId');
    if (!targetId) {
        res.status(400).json({ message: 'Missing targetId', status: 400 });
        return null;
    }

    const result = await resolveProviderTargetId(targetId);
    if ('message' in result) {
        res.status(result.status).json(result);
        return null;
    }

    return result;
}

function getClientOrigins() {
    const configured = process.env.CLIENT_URL?.split(',')
        .map((origin) => origin.trim())
        .filter(Boolean);

    if (configured?.length) {
        return configured;
    }

    return ['http://localhost:4200', 'https://ruvoplayer.vercel.app', '*'];
}

function getQueryString(query, key) {
    const value = query[key];
    if (Array.isArray(value)) {
        return normalizeQueryValue(value[0]);
    }
    return normalizeQueryValue(value);
}

function normalizeQueryValue(value) {
    if (typeof value !== 'string') {
        return undefined;
    }
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
}

function getProxyParams(query, excludedKeys) {
    const excluded = new Set(excludedKeys);
    const params = {};

    for (const [key, value] of Object.entries(query)) {
        if (excluded.has(key)) {
            continue;
        }
        const normalized = Array.isArray(value)
            ? normalizeQueryValue(value[0])
            : normalizeQueryValue(value);
        if (normalized) {
            params[key] = normalized;
        }
    }

    return params;
}

function appendPathSegment(url, segment) {
    const nextUrl = new URL(url.href);
    nextUrl.pathname = `${nextUrl.pathname.replace(/\/+$/, '')}/${segment}`;
    nextUrl.search = '';
    nextUrl.hash = '';
    return nextUrl.href;
}

const port = Number(process.env.PORT ?? 3333);
if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    app.listen(port, () => {
        console.log(`RuvoPlayer API listening on http://localhost:${port}`);
    });
}

export default app;
