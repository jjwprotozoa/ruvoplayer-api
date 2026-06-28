import { lookup } from 'node:dns/promises';
import { createHash } from 'node:crypto';
import { isIP } from 'node:net';

export function createProviderTargetId(url) {
    return createHash('sha256').update(url.href).digest('hex');
}

export function isPrivateNetworkProxyAllowed() {
    const value = process.env.IPTVNATOR_PROXY_ALLOW_PRIVATE_NETWORKS?.trim().toLowerCase();
    return value === '1' || value === 'true';
}

export async function validateProviderUrl(rawUrl, options = {}) {
    const allowPrivateNetworkTargets =
        options.allowPrivateNetworkTargets ?? isPrivateNetworkProxyAllowed();
    const resolveHostname = options.resolveHostname ?? resolveHostnameDefault;

    let url;
    try {
        url = new URL(rawUrl);
    } catch {
        return { message: 'Provider URL is not a valid URL', status: 400 };
    }

    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
        return {
            message: 'Only http and https provider URLs are supported',
            status: 400,
        };
    }

    if (url.username || url.password) {
        return {
            message: 'Provider URL credentials are not supported',
            status: 400,
        };
    }

    if (allowPrivateNetworkTargets) {
        return url;
    }

    const hostname = normalizeHostname(url.hostname);
    if (isLocalHostname(hostname) || isPrivateOrReservedIp(hostname)) {
        return {
            message: 'Provider URL points to a private or local network address',
            status: 400,
        };
    }

    if (isIP(hostname) === 0) {
        let addresses;
        try {
            addresses = await resolveHostname(hostname);
        } catch {
            return {
                message: 'Provider URL host could not be resolved',
                status: 400,
            };
        }

        if (
            addresses.length === 0 ||
            addresses.some((address) =>
                isPrivateOrReservedIp(normalizeHostname(address))
            )
        ) {
            return {
                message: 'Provider URL points to a private or local network address',
                status: 400,
            };
        }
    }

    return url;
}

async function resolveHostnameDefault(hostname) {
    const records = await lookup(hostname, { all: true, verbatim: true });
    return records.map((record) => record.address);
}

function normalizeHostname(hostname) {
    return hostname.trim().replace(/^\[/, '').replace(/\]$/, '').toLowerCase();
}

function isLocalHostname(hostname) {
    return hostname === 'localhost' || hostname.endsWith('.localhost');
}

function isPrivateOrReservedIp(address) {
    const version = isIP(address);
    if (version === 4) {
        return isPrivateOrReservedIpv4(address);
    }
    if (version === 6) {
        return isPrivateOrReservedIpv6(address);
    }
    return false;
}

function isPrivateOrReservedIpv4(address) {
    const parts = address.split('.').map((part) => Number(part));
    if (
        parts.length !== 4 ||
        parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)
    ) {
        return true;
    }

    const [a, b] = parts;
    if (a === 10) return true;
    if (a === 127) return true;
    if (a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
}

function isPrivateOrReservedIpv6(address) {
    const normalized = address.toLowerCase();
    if (normalized === '::1') return true;
    if (normalized.startsWith('fe80:')) return true;
    if (normalized.startsWith('fc') || normalized.startsWith('fd')) return true;
    return false;
}

export function normalizeXtreamServerUrl(serverUrl) {
    const trimmed = serverUrl.trim().replace(/\/+$/, '');
    if (trimmed.endsWith('/player_api.php')) {
        return trimmed.slice(0, -'/player_api.php'.length);
    }
    return trimmed;
}
