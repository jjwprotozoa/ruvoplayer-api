import axios from 'axios';
import { Agent as HttpsAgent } from 'node:https';

const TLS_ERROR_CODES = new Set([
    'CERT_HAS_EXPIRED',
    'DEPTH_ZERO_SELF_SIGNED_CERT',
    'ERR_TLS_CERT_ALTNAME_INVALID',
    'SELF_SIGNED_CERT_IN_CHAIN',
    'UNABLE_TO_GET_ISSUER_CERT',
    'UNABLE_TO_GET_ISSUER_CERT_LOCALLY',
    'UNABLE_TO_VERIFY_LEAF_SIGNATURE',
]);

function isInsecureTlsAllowed() {
    const value = process.env.IPTVNATOR_ALLOW_INSECURE_TLS?.trim().toLowerCase();
    return value === '1' || value === 'true';
}

export const httpClient = axios.create({
    headers: {
        Accept: '*/*',
        'Accept-Encoding': 'gzip, deflate, br',
        'User-Agent': 'IPTVnator',
    },
    httpsAgent: new HttpsAgent({
        rejectUnauthorized: !isInsecureTlsAllowed(),
    }),
    maxRedirects: 5,
    timeout: 30_000,
    validateStatus: (status) => status >= 200 && status < 300,
});

export function extractFetchError(error) {
    if (axios.isAxiosError(error)) {
        if (error.response) {
            const responseMessage =
                typeof error.response.data === 'string' &&
                error.response.data.trim().length > 0
                    ? error.response.data.trim().slice(0, 240)
                    : error.response.statusText;

            return {
                message: responseMessage || `HTTP ${error.response.status}`,
                status: error.response.status,
            };
        }

        if (error.code && TLS_ERROR_CODES.has(error.code)) {
            return {
                message:
                    'TLS certificate validation failed for the playlist provider. The server may use a self-signed or expired certificate.',
                status: 502,
            };
        }

        if (error.code === 'ECONNREFUSED' || error.code === 'ENOTFOUND') {
            return {
                message: error.message || 'Could not reach the playlist URL',
                status: 502,
            };
        }

        if (error.code === 'ETIMEDOUT' || error.code === 'ECONNABORTED') {
            return {
                message: 'Timed out while fetching the playlist URL',
                status: 504,
            };
        }

        return {
            message: error.message || 'Failed to fetch playlist URL',
            status: 502,
        };
    }

    if (error instanceof Error) {
        return {
            message: error.message || 'Failed to parse playlist',
            status: 500,
        };
    }

    return {
        message: 'Error, something went wrong',
        status: 500,
    };
}
