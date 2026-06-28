export function normalizeM3uContent(raw) {
    let content = coerceToUtf8String(raw);
    content = content.replace(/^\uFEFF/, '').trimStart();

    const extm3uIndex = content.indexOf('#EXTM3U');
    if (extm3uIndex > 0) {
        content = content.slice(extm3uIndex);
    }

    return content;
}

export function describeInvalidM3uContent(content) {
    const sample = content.trimStart().slice(0, 120).toLowerCase();

    if (sample.startsWith('<!doctype html') || sample.startsWith('<html')) {
        return 'The playlist URL returned HTML instead of an M3U file. The provider may require authentication or block server-side requests.';
    }

    if (sample.startsWith('{') || sample.startsWith('[')) {
        return 'The playlist URL returned JSON instead of an M3U file. Check that the URL points to a playlist file, not an API endpoint.';
    }

    if (!content.includes('#EXTM3U')) {
        return 'The playlist URL did not return an M3U playlist (missing #EXTM3U header).';
    }

    return 'The playlist file could not be parsed as a valid M3U playlist.';
}

function coerceToUtf8String(raw) {
    if (typeof raw === 'string') {
        return raw;
    }

    if (Buffer.isBuffer(raw)) {
        return raw.toString('utf8');
    }

    if (raw instanceof ArrayBuffer) {
        return Buffer.from(raw).toString('utf8');
    }

    return String(raw ?? '');
}
