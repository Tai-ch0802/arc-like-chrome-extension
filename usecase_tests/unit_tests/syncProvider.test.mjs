import { NoopSyncProvider, createFakeSyncProvider } from '../../modules/sync/syncProvider.js';

describe('syncProvider', () => {
    describe('createFakeSyncProvider', () => {
        let provider;

        beforeEach(() => {
            provider = createFakeSyncProvider();
        });

        it('isConnected defaults to true', async () => {
            await expect(provider.isConnected()).resolves.toBe(true);
        });

        it('isConnected reflects opts.connected', async () => {
            const offline = createFakeSyncProvider({ connected: false });
            await expect(offline.isConnected()).resolves.toBe(false);
        });

        it('write new name -> version 1, fileId truthy; read returns same json + version 1', async () => {
            const res = await provider.write('ws_a.json', { hello: 'world' });
            expect(res.version).toBe(1);
            expect(res.fileId).toBeTruthy();

            const got = await provider.read('ws_a.json');
            expect(got).not.toBeNull();
            expect(got.json).toEqual({ hello: 'world' });
            expect(got.version).toBe(1);
            expect(got.fileId).toBe(res.fileId);
        });

        it('write existing name again -> version 2; read reflects new json + version 2', async () => {
            const first = await provider.write('ws_a.json', { n: 1 });
            const second = await provider.write('ws_a.json', { n: 2 });
            expect(second.version).toBe(2);
            expect(second.fileId).toBe(first.fileId);

            const got = await provider.read('ws_a.json');
            expect(got.json).toEqual({ n: 2 });
            expect(got.version).toBe(2);
        });

        it('read missing name -> null', async () => {
            await expect(provider.read('nope.json')).resolves.toBeNull();
        });

        it('list returns all written names with their versions', async () => {
            await provider.write('ws_a.json', { a: 1 });
            await provider.write('ws_b.json', { b: 1 });
            await provider.write('ws_b.json', { b: 2 });

            const list = await provider.list();
            expect(Array.isArray(list)).toBe(true);
            const byName = Object.fromEntries(list.map((e) => [e.name, e]));
            expect(Object.keys(byName).sort()).toEqual(['ws_a.json', 'ws_b.json']);
            expect(byName['ws_a.json'].version).toBe(1);
            expect(byName['ws_b.json'].version).toBe(2);
            expect(byName['ws_a.json'].fileId).toBeTruthy();
            expect(byName['ws_b.json'].fileId).toBeTruthy();
        });

        it('remove deletes (read after remove -> null)', async () => {
            await provider.write('ws_a.json', { a: 1 });
            await provider.remove('ws_a.json');
            await expect(provider.read('ws_a.json')).resolves.toBeNull();
        });

        it('remove of absent name is a no-op', async () => {
            await expect(provider.remove('ghost.json')).resolves.toBeUndefined();
        });

        it('deep-clone isolation: mutating read result does not change stored state', async () => {
            await provider.write('ws_a.json', { nested: { v: 1 } });
            const got = await provider.read('ws_a.json');
            got.json.nested.v = 999;

            const again = await provider.read('ws_a.json');
            expect(again.json.nested.v).toBe(1);
        });

        it('deep-clone isolation: mutating write input afterwards does not change stored state', async () => {
            const input = { nested: { v: 1 } };
            await provider.write('ws_a.json', input);
            input.nested.v = 999;

            const got = await provider.read('ws_a.json');
            expect(got.json.nested.v).toBe(1);
        });

        it('__failNext("write", error) makes the next write reject once, then succeeds', async () => {
            provider.__failNext('write', new Error('boom'));
            await expect(provider.write('ws_a.json', { a: 1 })).rejects.toThrow('boom');

            const res = await provider.write('ws_a.json', { a: 1 });
            expect(res.version).toBe(1);

            const got = await provider.read('ws_a.json');
            expect(got.json).toEqual({ a: 1 });
        });

        it('__failNext can target read and remove too', async () => {
            await provider.write('ws_a.json', { a: 1 });

            provider.__failNext('read', new Error('read-boom'));
            await expect(provider.read('ws_a.json')).rejects.toThrow('read-boom');
            await expect(provider.read('ws_a.json')).resolves.not.toBeNull();

            provider.__failNext('remove', new Error('remove-boom'));
            await expect(provider.remove('ws_a.json')).rejects.toThrow('remove-boom');
            await expect(provider.remove('ws_a.json')).resolves.toBeUndefined();
        });
    });

    describe('NoopSyncProvider', () => {
        let provider;

        beforeEach(() => {
            provider = new NoopSyncProvider();
        });

        it('isConnected -> false', async () => {
            await expect(provider.isConnected()).resolves.toBe(false);
        });

        it('list -> []', async () => {
            await expect(provider.list()).resolves.toEqual([]);
        });

        it('read -> null', async () => {
            await expect(provider.read('anything.json')).resolves.toBeNull();
        });

        it('write -> resolves with {version:0, fileId:""}', async () => {
            await expect(provider.write('anything.json', { a: 1 })).resolves.toEqual({ version: 0, fileId: '' });
        });

        it('remove -> resolves without throwing', async () => {
            await expect(provider.remove('anything.json')).resolves.toBeUndefined();
        });
    });
});
