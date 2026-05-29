import { createGoogleDriveProvider } from '../../modules/sync/googleDriveProvider.js';

/**
 * Build a mock authedFetch that records each request and replies with the next
 * queued canned response. Each canned response is a minimal Response-like:
 *   { ok, status, json: async()=>(...), text: async()=>(...) }
 */
function makeMockFetch() {
    const calls = [];
    const queue = [];

    const mock = async (url, init = {}) => {
        calls.push({ url, init });
        if (queue.length === 0) {
            throw new Error(`mock authedFetch: no queued response for ${url}`);
        }
        const next = queue.shift();
        if (typeof next === 'function') return next(url, init);
        return next;
    };

    /** Queue a JSON 200 OK response. */
    mock.queueJson = (obj, status = 200) => {
        queue.push({
            ok: status >= 200 && status < 300,
            status,
            json: async () => obj,
            text: async () => JSON.stringify(obj),
        });
        return mock;
    };

    /** Queue a raw-text/body response (e.g. alt=media file content). */
    mock.queueBody = (body, status = 200) => {
        const text = typeof body === 'string' ? body : JSON.stringify(body);
        queue.push({
            ok: status >= 200 && status < 300,
            status,
            json: async () => JSON.parse(text),
            text: async () => text,
        });
        return mock;
    };

    /** Queue an error (non-ok) response. */
    mock.queueError = (status, obj = { error: { message: 'boom' } }) => {
        queue.push({
            ok: false,
            status,
            json: async () => obj,
            text: async () => JSON.stringify(obj),
        });
        return mock;
    };

    mock.calls = calls;
    return mock;
}

describe('googleDriveProvider', () => {
    describe('isConnected', () => {
        it('delegates to the injected isConnected', async () => {
            const isConnected = jest.fn().mockResolvedValue(true);
            const provider = createGoogleDriveProvider({ authedFetch: makeMockFetch(), isConnected });
            await expect(provider.isConnected()).resolves.toBe(true);
            expect(isConnected).toHaveBeenCalledTimes(1);

            const off = createGoogleDriveProvider({
                authedFetch: makeMockFetch(),
                isConnected: async () => false,
            });
            await expect(off.isConnected()).resolves.toBe(false);
        });
    });

    describe('list', () => {
        it('maps files and coerces version to Number; uses appDataFolder + fields mask', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [{ id: 'f1', name: 'ws_a.json', version: '3' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });

            const list = await provider.list();
            expect(list).toEqual([{ name: 'ws_a.json', fileId: 'f1', version: 3 }]);

            const url = fetch.calls[0].url;
            expect(url).toContain('spaces=appDataFolder');
            const decoded = decodeURIComponent(url);
            expect(decoded).toContain('files(id,name,version)');
            expect(decoded).toContain('nextPageToken');
        });

        it('paginates via nextPageToken and concatenates pages', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [{ id: 'f1', name: 'a.json', version: '1' }], nextPageToken: 'TOK' });
            fetch.queueJson({ files: [{ id: 'f2', name: 'b.json', version: '2' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });

            const list = await provider.list();
            expect(list).toEqual([
                { name: 'a.json', fileId: 'f1', version: 1 },
                { name: 'b.json', fileId: 'f2', version: 2 },
            ]);
            expect(fetch.calls.length).toBe(2);
            // Second request carries the page token.
            expect(fetch.calls[1].url).toContain('pageToken=TOK');
        });

        it('throws on non-ok status (engine classifies)', async () => {
            const fetch = makeMockFetch();
            fetch.queueError(500);
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await expect(provider.list()).rejects.toThrow();
        });
    });

    describe('read', () => {
        it('q-lookup resolves fileId+version, then alt=media returns JSON body', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [{ id: 'f9', version: '7' }] }); // q-lookup
            fetch.queueBody({ hello: 'world' }); // alt=media
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });

            const res = await provider.read('ws_a.json');
            expect(res).toEqual({ json: { hello: 'world' }, version: 7, fileId: 'f9' });

            // q-lookup is URL-encoded and scoped to appDataFolder.
            expect(fetch.calls[0].url).toContain('spaces=appDataFolder');
            expect(decodeURIComponent(fetch.calls[0].url)).toContain("name='ws_a.json'");
            // alt=media request issued against the resolved fileId.
            expect(fetch.calls[1].url).toContain('/f9');
            expect(fetch.calls[1].url).toContain('alt=media');
        });

        it('returns null when q-lookup finds no file (no alt=media call)', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });

            await expect(provider.read('missing.json')).resolves.toBeNull();
            expect(fetch.calls.length).toBe(1); // only the q-lookup
        });

        it('uses cached fileId from a prior list, fetching version via fields=version', async () => {
            const fetch = makeMockFetch();
            // Prime the cache via list (id only, no version in this scenario).
            fetch.queueJson({ files: [{ id: 'f1', name: 'ws_a.json' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await provider.list();

            // read: cached id -> fields=version metadata lookup -> alt=media body.
            fetch.queueJson({ version: '12' });
            fetch.queueBody({ k: 'v' });
            const res = await provider.read('ws_a.json');
            expect(res).toEqual({ json: { k: 'v' }, version: 12, fileId: 'f1' });

            // No q-lookup needed (cache hit); metadata + media only.
            expect(fetch.calls[1].url).toContain('/f1');
            expect(fetch.calls[1].url).toContain('fields=version');
            expect(fetch.calls[2].url).toContain('alt=media');
        });
    });

    describe('write', () => {
        it('create: POST multipart/related with metadata (name + appDataFolder parent) and JSON content', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [] }); // q-lookup: no existing file
            fetch.queueJson({ id: 'new1', version: '1' }); // upload response
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });

            const res = await provider.write('ws_a.json', { content: 42 });
            expect(res).toEqual({ version: 1, fileId: 'new1' });

            const uploadCall = fetch.calls[1];
            expect(uploadCall.url).toContain('/upload/drive/v3/files');
            expect(uploadCall.url).toContain('uploadType=multipart');
            expect(uploadCall.init.method).toBe('POST');
            const ct = uploadCall.init.headers['Content-Type'];
            expect(ct).toMatch(/^multipart\/related; boundary=/);

            const body = uploadCall.init.body;
            expect(body).toContain('"name":"ws_a.json"');
            expect(body).toContain('"parents":["appDataFolder"]');
            expect(body).toContain('"content":42');
            // boundary value present in body delimiters
            const boundary = ct.split('boundary=')[1];
            expect(body).toContain(`--${boundary}`);
            expect(body).toContain(`--${boundary}--`);
        });

        it('update: PATCH upload/{id}?uploadType=media with JSON body; returns new version', async () => {
            const fetch = makeMockFetch();
            // Prime cache with an existing file via list.
            fetch.queueJson({ files: [{ id: 'f1', name: 'ws_a.json', version: '3' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await provider.list();

            fetch.queueJson({ id: 'f1', version: '4' }); // PATCH response
            const res = await provider.write('ws_a.json', { content: 'updated' });
            expect(res).toEqual({ version: 4, fileId: 'f1' });

            const patchCall = fetch.calls[1];
            expect(patchCall.url).toContain('/upload/drive/v3/files/f1');
            expect(patchCall.url).toContain('uploadType=media');
            expect(patchCall.init.method).toBe('PATCH');
            expect(patchCall.init.headers['Content-Type']).toBe('application/json');
            expect(patchCall.init.body).toBe(JSON.stringify({ content: 'updated' }));
        });

        it('throws on non-ok upload status', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [] }); // q-lookup
            fetch.queueError(500); // upload fails
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await expect(provider.write('ws_a.json', { a: 1 })).rejects.toThrow();
        });
    });

    describe('remove', () => {
        it('existing: issues DELETE files/{id} and clears the cache', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [{ id: 'f1', name: 'ws_a.json', version: '1' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await provider.list();

            fetch.queueJson({}, 204); // DELETE ok (204 No Content)
            await expect(provider.remove('ws_a.json')).resolves.toBeUndefined();

            const delCall = fetch.calls[1];
            expect(delCall.url).toContain('/drive/v3/files/f1');
            expect(delCall.init.method).toBe('DELETE');

            // Cache cleared: a subsequent read must do a fresh q-lookup.
            fetch.queueJson({ files: [] });
            await expect(provider.read('ws_a.json')).resolves.toBeNull();
        });

        it('missing: no DELETE issued (no-op)', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [] }); // q-lookup finds nothing
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });

            await expect(provider.remove('ghost.json')).resolves.toBeUndefined();
            expect(fetch.calls.length).toBe(1); // only the q-lookup, no DELETE
        });

        it('404 on delete is treated as already-gone (no throw)', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [{ id: 'f1', name: 'ws_a.json', version: '1' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await provider.list();

            fetch.queueError(404);
            await expect(provider.remove('ws_a.json')).resolves.toBeUndefined();
        });

        it('throws on other non-ok delete status (e.g. 500)', async () => {
            const fetch = makeMockFetch();
            fetch.queueJson({ files: [{ id: 'f1', name: 'ws_a.json', version: '1' }] });
            const provider = createGoogleDriveProvider({ authedFetch: fetch, isConnected: async () => true });
            await provider.list();

            fetch.queueError(500);
            await expect(provider.remove('ws_a.json')).rejects.toThrow();
        });
    });
});
