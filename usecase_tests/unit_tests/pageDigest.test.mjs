import { generatePageDigest } from '../../modules/aiManager.js';
import { STORAGE_KEY } from '../../modules/ai/providerSettings.js';

/** chrome mock: cloud provider (gemini) active, storage + i18n stubs. */
function installChromeMock() {
  global.chrome = {
    storage: {
      local: {
        get: (keys, cb) => cb({
          [STORAGE_KEY]: {
            activeProvider: 'gemini',
            providers: { gemini: { apiKey: 'test-key', model: 'gemini-2.5-flash' } },
          },
        }),
        set: (items, cb) => cb(),
      },
    },
    i18n: {
      getUILanguage: () => 'zh-TW',
      getMessage: () => '',
    },
  };
}

/** Builds a Gemini generateContent 200 response whose text is `text`. */
function geminiReply(text) {
  return {
    ok: true,
    json: async () => ({ candidates: [{ content: { parts: [{ text }] } }] }),
  };
}

const PAGE = { title: 'IoT 的美麗與哀愁', url: 'https://example.substack.com/p/iot', text: '文章內容 '.repeat(100) };
const GOOD_JSON = '[{"tldr":"這是摘要。","keyPoints":["重點一","重點二","重點三"]}]';

beforeEach(() => installChromeMock());
afterEach(() => {
  delete global.chrome;
  delete global.fetch;
});

describe('generatePageDigest (cloud)', () => {
  it('parses a well-formed reply into {tldr, keyPoints}', async () => {
    global.fetch = jest.fn().mockResolvedValue(geminiReply(GOOD_JSON));
    const digest = await generatePageDigest(PAGE);
    expect(digest).toEqual({ tldr: '這是摘要。', keyPoints: ['重點一', '重點二', '重點三'] });
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('retries once when the first reply is truncated/unparsable JSON', async () => {
    const truncated = '[{"tldr":"這是摘要。","keyPoints":["重點一","重'; // max_tokens cut mid-string
    global.fetch = jest.fn()
      .mockResolvedValueOnce(geminiReply(truncated))
      .mockResolvedValueOnce(geminiReply(GOOD_JSON));
    const digest = await generatePageDigest(PAGE);
    expect(digest).toEqual({ tldr: '這是摘要。', keyPoints: ['重點一', '重點二', '重點三'] });
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns null after two unparsable replies', async () => {
    global.fetch = jest.fn().mockResolvedValue(geminiReply('not json at all'));
    const digest = await generatePageDigest(PAGE);
    expect(digest).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('returns null without retry when the API call itself fails', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401, text: async () => 'unauthorized' });
    const digest = await generatePageDigest(PAGE);
    expect(digest).toBeNull();
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it('caps keyPoints at 5', async () => {
    const many = '[{"tldr":"摘要","keyPoints":["1","2","3","4","5","6","7"]}]';
    global.fetch = jest.fn().mockResolvedValue(geminiReply(many));
    const digest = await generatePageDigest(PAGE);
    expect(digest.keyPoints).toEqual(['1', '2', '3', '4', '5']);
  });

  it('returns null for empty input text', async () => {
    global.fetch = jest.fn();
    expect(await generatePageDigest({ title: 't', url: 'u', text: '' })).toBeNull();
    expect(global.fetch).not.toHaveBeenCalled();
  });
});
