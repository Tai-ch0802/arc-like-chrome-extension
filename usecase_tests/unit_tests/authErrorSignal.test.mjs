import { runPrompt } from '../../modules/aiManager.js';
import { STORAGE_KEY } from '../../modules/ai/providerSettings.js';

/** chrome mock with a recording storage.local, cloud provider active. */
function installChromeMock() {
  const store = {
    [STORAGE_KEY]: {
      activeProvider: 'anthropic',
      providers: { anthropic: { apiKey: 'sk-ant-bad', model: 'claude-opus-4-8' } },
    },
  };
  global.chrome = {
    storage: {
      local: {
        get: (keys, cb) => {
          const out = {};
          for (const k of Array.isArray(keys) ? keys : [keys]) {
            if (k in store) out[k] = store[k];
          }
          cb(out);
        },
        set: (items, cb) => {
          Object.assign(store, items);
          cb();
        },
      },
    },
    i18n: { getUILanguage: () => 'zh-TW', getMessage: () => '' },
  };
  return store;
}

afterEach(() => {
  delete global.chrome;
  delete global.fetch;
});

describe('cloud auth-error signal', () => {
  it('writes aiProviderAuthError to storage.local on HTTP 401', async () => {
    const store = installChromeMock();
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"invalid x-api-key"}}',
    });
    const out = await runPrompt('hello');
    expect(out).toBeNull();
    // setStorage is fire-and-forget — flush the microtask queue
    await new Promise(r => setTimeout(r, 0));
    expect(store.aiProviderAuthError).toMatchObject({ providerId: 'anthropic', status: 401 });
    expect(typeof store.aiProviderAuthError.at).toBe('number');
  });

  it('does NOT write the signal for non-auth failures (e.g. 500)', async () => {
    const store = installChromeMock();
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 500, text: async () => 'oops' });
    const out = await runPrompt('hello');
    expect(out).toBeNull();
    await new Promise(r => setTimeout(r, 0));
    expect(store.aiProviderAuthError).toBeUndefined();
  });

  it('does NOT write the signal for network errors', async () => {
    const store = installChromeMock();
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const out = await runPrompt('hello');
    expect(out).toBeNull();
    await new Promise(r => setTimeout(r, 0));
    expect(store.aiProviderAuthError).toBeUndefined();
  });
});
