import http from 'node:http';
import https from 'node:https';

const STREAM_PROXY_MAX_REDIRECTS = 5;

export function handleStreamProxy(req, res, targetUrl, redirectCount = 0) {
    if (redirectCount > STREAM_PROXY_MAX_REDIRECTS) {
        res.status(508).json({
            status: 'error',
            message: 'Too many redirects while fetching stream',
        });
        return;
    }

    const isHead = req.method === 'HEAD';
    const httpModule = targetUrl.protocol === 'https:' ? https : http;

    const headers = {
        'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 ' +
            '(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        Accept: '*/*',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'identity',
        Connection: 'keep-alive',
        'Sec-Fetch-Dest': 'video',
        'Sec-Fetch-Mode': 'cors',
        'Sec-Fetch-Site': 'cross-site',
        Referer: targetUrl.origin,
    };

    if (req.headers.range) {
        headers['Range'] = req.headers.range;
    }
    if (req.headers.authorization) {
        headers['Authorization'] = req.headers.authorization;
    }

    const request = httpModule.request(
        targetUrl.href,
        {
            method: isHead ? 'HEAD' : 'GET',
            headers,
            timeout: 60000,
        },
        (upstream) => {
            if (
                upstream.statusCode &&
                upstream.statusCode >= 300 &&
                upstream.statusCode < 400 &&
                upstream.headers.location
            ) {
                upstream.resume();
                try {
                    const nextUrl = new URL(
                        upstream.headers.location,
                        targetUrl.href
                    );
                    handleStreamProxy(req, res, nextUrl, redirectCount + 1);
                } catch {
                    res.status(400).json({
                        status: 'error',
                        message: 'Invalid redirect location from stream server',
                    });
                }
                return;
            }

            if (upstream.statusCode !== 200 && upstream.statusCode !== 206) {
                res.status(upstream.statusCode || 500).json({
                    status: 'error',
                    message: `Stream server responded with status ${upstream.statusCode}`,
                });
                return;
            }

            const contentType =
                upstream.headers['content-type'] || 'application/octet-stream';
            const contentLength = upstream.headers['content-length'];
            const acceptRanges = upstream.headers['accept-ranges'] || 'bytes';
            const contentRange = upstream.headers['content-range'];

            res.setHeader('Content-Type', contentType);
            if (contentLength) {
                res.setHeader('Content-Length', contentLength);
            }
            if (acceptRanges) {
                res.setHeader('Accept-Ranges', acceptRanges);
            }
            if (contentRange) {
                res.setHeader('Content-Range', contentRange);
            }
            res.setHeader('Cache-Control', 'no-store');

            res.status(upstream.statusCode);
            if (isHead) {
                res.end();
                return;
            }

            upstream.on('error', () => {
                if (!res.headersSent) {
                    res.status(500).json({
                        status: 'error',
                        message: 'Upstream stream error',
                    });
                }
            });

            upstream.pipe(res);
        }
    );

    request.on('timeout', () => {
        request.destroy();
        if (!res.headersSent) {
            res.status(504).json({
                status: 'error',
                message: 'Upstream stream timed out',
            });
        }
    });

    request.on('error', () => {
        if (!res.headersSent) {
            res.status(502).json({
                status: 'error',
                message: 'Failed to connect to stream server',
            });
        }
    });

    request.end();
}
