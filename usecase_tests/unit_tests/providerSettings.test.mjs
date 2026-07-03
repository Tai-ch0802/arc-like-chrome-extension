import {
  STORAGE_KEY,
  PROVIDER_IDS,
  getProviderSettings,
  getActiveProvider,
  setActiveProvider,
  saveProviderConfig,
  isProviderConfigured,
} from '../../modules/ai/providerSettings.js';

/** Minimal chrome.storage.local mock backed by a plain object. */
function installChromeMock(initial = {}) {
  const store = { ...initial };
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
  };
  return store;
}

afterEach(() => {
  delete global.chrome;
});

describe('getProviderSettings', () => {
  it('returns full defaults when nothing is stored', async () => {
    installChromeMock();
    const s = await getProviderSettings();
    expect(s.activeProvider).toBe('builtin');
    expect(s.providers.gemini.model).toBe('gemini-2.5-flash');
    expect(s.providers.anthropic.model).toBe('claude-opus-4-8');
    expect(s.providers.openai.baseUrl).toBe('https://api.openai.com/v1');
    expect(s.providers.ollama.baseUrl).toBe('http://localhost:11434');
  });

  it('deep-merges partial stored data over defaults', async () => {
    installChromeMock({
      [STORAGE_KEY]: { activeProvider: 'gemini', providers: { gemini: { apiKey: 'k' } } },
    });
    const s = await getProviderSettings();
    expect(s.activeProvider).toBe('gemini');
    expect(s.providers.gemini.apiKey).toBe('k');
    expect(s.providers.gemini.model).toBe('gemini-2.5-flash'); // default preserved
    expect(s.providers.ollama.baseUrl).toBe('http://localhost:11434');
  });

  it('falls back to builtin for an unknown stored activeProvider', async () => {
    installChromeMock({ [STORAGE_KEY]: { activeProvider: 'bogus' } });
    const s = await getProviderSettings();
    expect(s.activeProvider).toBe('builtin');
  });

  it('empty-string fields fall back to defaults (cleared model input)', async () => {
    installChromeMock({
      [STORAGE_KEY]: { providers: { gemini: { apiKey: 'k', model: '' } } },
    });
    const s = await getProviderSettings();
    expect(s.providers.gemini.model).toBe('gemini-2.5-flash');
    expect(s.providers.gemini.apiKey).toBe('k');
  });
});

describe('getActiveProvider / setActiveProvider', () => {
  it('returns id + config for the active provider', async () => {
    installChromeMock({
      [STORAGE_KEY]: { activeProvider: 'anthropic', providers: { anthropic: { apiKey: 'a' } } },
    });
    const { id, config } = await getActiveProvider();
    expect(id).toBe('anthropic');
    expect(config.apiKey).toBe('a');
  });

  it('setActiveProvider switches without touching provider configs', async () => {
    const store = installChromeMock({
      [STORAGE_KEY]: { activeProvider: 'gemini', providers: { gemini: { apiKey: 'gk' } } },
    });
    await setActiveProvider('ollama');
    expect(store[STORAGE_KEY].activeProvider).toBe('ollama');
    expect(store[STORAGE_KEY].providers.gemini.apiKey).toBe('gk');
  });

  it('rejects unknown provider ids', async () => {
    installChromeMock();
    await expect(setActiveProvider('skynet')).rejects.toThrow(/Unknown AI provider/);
  });
});

describe('saveProviderConfig', () => {
  it('merges a patch and preserves sibling providers', async () => {
    const store = installChromeMock({
      [STORAGE_KEY]: {
        activeProvider: 'builtin',
        providers: { gemini: { apiKey: 'gk' }, ollama: { model: 'llama3.2' } },
      },
    });
    await saveProviderConfig('ollama', { baseUrl: 'http://10.0.0.2:11434' });
    const saved = store[STORAGE_KEY];
    expect(saved.providers.ollama.baseUrl).toBe('http://10.0.0.2:11434');
    expect(saved.providers.ollama.model).toBe('llama3.2');
    expect(saved.providers.gemini.apiKey).toBe('gk');
  });

  it('rejects builtin and unknown ids', async () => {
    installChromeMock();
    await expect(saveProviderConfig('builtin', {})).rejects.toThrow();
    await expect(saveProviderConfig('nope', {})).rejects.toThrow();
  });

  it('write paths preserve provider entries unknown to this version', async () => {
    const store = installChromeMock({
      [STORAGE_KEY]: {
        activeProvider: 'builtin',
        providers: { futureProvider: { apiKey: 'future-key' } },
      },
    });
    await saveProviderConfig('gemini', { apiKey: 'gk' });
    await setActiveProvider('gemini');
    expect(store[STORAGE_KEY].providers.futureProvider).toEqual({ apiKey: 'future-key' });
    expect(store[STORAGE_KEY].providers.gemini.apiKey).toBe('gk');
  });
});

describe('isProviderConfigured', () => {
  it('covers the full provider matrix', () => {
    expect(isProviderConfigured('builtin')).toBe(true);
    expect(isProviderConfigured('gemini', { apiKey: 'k', model: 'm' })).toBe(true);
    expect(isProviderConfigured('gemini', { apiKey: '', model: 'm' })).toBe(false);
    expect(isProviderConfigured('anthropic', { apiKey: 'k', model: 'm' })).toBe(true);
    expect(isProviderConfigured('anthropic', { apiKey: 'k', model: '' })).toBe(false);
    expect(isProviderConfigured('openai', { apiKey: 'k', model: 'm', baseUrl: 'u' })).toBe(true);
    expect(isProviderConfigured('openai', { apiKey: '', model: 'm', baseUrl: 'u' })).toBe(true); // keyless local gateways
    expect(isProviderConfigured('openai', { apiKey: 'k', model: '', baseUrl: 'u' })).toBe(false);
    expect(isProviderConfigured('ollama', { baseUrl: 'u', model: 'm' })).toBe(true);
    expect(isProviderConfigured('ollama', { baseUrl: 'u', model: '' })).toBe(false);
    expect(isProviderConfigured('unknown', {})).toBe(false);
  });

  it('every PROVIDER_IDS entry has a defined answer', () => {
    for (const id of PROVIDER_IDS) {
      expect(typeof isProviderConfigured(id, {})).toBe('boolean');
    }
  });
});
