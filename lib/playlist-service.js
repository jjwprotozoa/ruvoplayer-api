import parser from 'iptv-playlist-parser';
import { extractFetchError, httpClient } from './http-client.js';
import {
    describeInvalidM3uContent,
    normalizeM3uContent,
} from './normalize-m3u-content.js';

export async function parsePlaylistFromUrl(url) {
    try {
        const response = await httpClient.get(url);
        const playlistContent = normalizeM3uContent(response.data);
        let parsedPlaylist;

        try {
            parsedPlaylist = parser.parse(playlistContent);
        } catch (parseError) {
            if (
                parseError instanceof Error &&
                parseError.message === 'Playlist is not valid'
            ) {
                return {
                    error: {
                        message: describeInvalidM3uContent(playlistContent),
                        status: 422,
                    },
                };
            }

            throw parseError;
        }

        return {
            playlist: createPlaylistObject({
                parsedPlaylist,
                title: getLastUrlSegment(url),
                url,
            }),
        };
    } catch (error) {
        return { error: extractFetchError(error) };
    }
}

function createPlaylistObject({ parsedPlaylist, title, url }) {
    const timestamp = new Date().toISOString();
    const id = createGuid();

    return {
        id,
        _id: id,
        filename: title,
        title,
        count: parsedPlaylist.items.length,
        playlist: {
            ...parsedPlaylist,
            items: parsedPlaylist.items.map((item) => ({
                id: createGuid(),
                ...item,
            })),
        },
        importDate: timestamp,
        lastUsage: timestamp,
        favorites: [],
        autoRefresh: false,
        url,
    };
}

function getLastUrlSegment(value) {
    const segment = value.slice(value.lastIndexOf('/') + 1).trim();
    return segment.length > 0 ? segment : 'Playlist without title';
}

function createGuid() {
    return Math.random().toString(36).slice(2);
}
