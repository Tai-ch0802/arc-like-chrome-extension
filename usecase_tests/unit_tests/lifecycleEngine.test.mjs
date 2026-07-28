// Unit tests for the fail-closed lifecycle:snooze ack (BASE-024 P3, review
// PR #222): the serialize chain swallows errors, so a failed persist or a
// failed alarm registration MUST still ack ok:false — the caller closes the
// tab only on a truthful ok:true.
import { handleLifecycleMessage } from '../../modules/lifecycle/lifecycleEngine.js';

let store;
let failNextSet;
let alarmCalls;
let alarmShouldReject;

beforeEach(() => {
    store = {};
    failNextSet = false;
    alarmCalls = [];
    alarmShouldReject = false;
    globalThis.chrome = {
        ...globalThis.chrome,
        runtime: { ...(globalThis.chrome?.runtime || {}), lastError: undefined },
        alarms: {
            create: (name, info) => {
                alarmCalls.push({ name, info });
                return alarmShouldReject ? Promise.reject(new Error('alarm boom')) : Promise.resolve();
            },
            clear: () => Promise.resolve(true),
            get: (name, cb) => cb && cb(undefined),
        },
        storage: {
            ...(globalThis.chrome?.storage || {}),
            local: {
                get: (keys, cb) => {
                    const out = {};
                    for (const k of Object.keys(keys)) out[k] = k in store ? store[k] : keys[k];
                    cb(out);
                },
                set: (items, cb) => {
                    if (failNextSet) {
                        failNextSet = false;
                        globalThis.chrome.runtime.lastError = { message: 'quota boom' };
                        cb();
                        globalThis.chrome.runtime.lastError = undefined;
                        return;
                    }
                    Object.assign(store, items);
                    cb();
                },
            },
            sync: { get: (defaults, cb) => cb ? cb(defaults) : Promise.resolve(defaults) },
            onChanged: { addListener: () => {} },
        },
    };
});

const item = () => ({
    id: 'sn-1', url: 'https://example.com/s', title: 'S',
    favIconUrl: '', snoozedAt: 1000, wakeAt: 999_999,
});

function snooze() {
    return new Promise((resolve) => {
        const handled = handleLifecycleMessage(
            { action: 'lifecycle:snooze', item: item() },
            (response) => resolve(response),
        );
        expect(handled).toBe(true); // claims the message (async sendResponse)
    });
}

describe('lifecycle:snooze fail-closed ack', () => {
    test('success: persists, registers the wake alarm, acks ok:true', async () => {
        const ack = await snooze();
        expect(ack).toEqual({ ok: true });
        expect(store.snoozedTabs.items.map(i => i.id)).toEqual(['sn-1']);
        expect(alarmCalls).toEqual([{ name: 'lifecycleWake_sn-1', info: { when: 999_999 } }]);
    });

    test('persist failure → ok:false and NO alarm registered (FR-4.02 gate)', async () => {
        failNextSet = true;
        const ack = await snooze();
        expect(ack).toEqual({ ok: false });
        expect(store.snoozedTabs).toBeUndefined();
        expect(alarmCalls).toEqual([]); // never got past the store write
    });

    test('alarm registration failure → ok:false (a record that never wakes must not close the tab)', async () => {
        alarmShouldReject = true;
        const ack = await snooze();
        expect(ack).toEqual({ ok: false });
    });

    test('unknown lifecycle action is not claimed', () => {
        expect(handleLifecycleMessage({ action: 'lifecycle:nope' }, () => {})).toBe(false);
    });
});
