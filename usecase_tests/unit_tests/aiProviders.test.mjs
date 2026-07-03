import * as gemini from '../../modules/ai/providers/geminiProvider.js';
import * as anthropic from '../../modules/ai/providers/anthropicProvider.js';
import * as openaiCompat from '../../modules/ai/providers/openaiCompatProvider.js';
import * as ollama from '../../modules/ai/providers/ollamaProvider.js';
import { getCloudProvider } from '../../modules/ai/providers/index.js';
import { normalizeBaseUrl, isInsecureRemoteBaseUrl, readStreamLines, HttpError } from '../../modules/ai/providers/httpUtils.js';

const PARAMS = { system: 'sys prompt', prompt: 'user prompt', maxTokens: 512 };

/**
 * Builds a fetch()-shaped Response whose body streams the given chunks
 * (strings are UTF-8 encoded; Uint8Arrays pass through for byte-boundary
 * tests). Mirrors the minimal reader surface readStreamLines relies on.
 */
function streamResponse(chunks, { ok = true, status = 200 } = {}) {
  const encoder = new TextEncoder();
  const queue = chunks.map(c => (typeof c === 'string' ? encoder.encode(c) : c));
  return {
    ok,
    status,
    text: async () => chunks.join(''),
    body: {
      getReader: () => ({
        read: async () => (queue.length
          ? { done: false, value: queue.shift() }
          : { done: true, value: undefined }),
        cancel: async () => { queue.length = 0; },
      }),
    },
  };
}

afterEach(() => {
  delete global.fetch;
});

describe('provider registry', () => {
  it('maps cloud ids to modules and builtin to null', () => {
    // Compare function identity (the CJS transform re-wraps namespace objects).
    expect(getCloudProvider('gemini').chat).toBe(gemini.chat);
    expect(getCloudProvider('anthropic').chat).toBe(anthropic.chat);
    expect(getCloudProvider('openai').chat).toBe(openaiCompat.chat);
    expect(getCloudProvider('ollama').chat).toBe(ollama.chat);
    expect(getCloudProvider('builtin')).toBeNull();
    expect(getCloudProvider('nope')).toBeNull();
  });
});

describe('geminiProvider', () => {
  const config = { apiKey: 'g-key', model: 'gemini-2.5-flash' };

  it('builds request with key in header, never in URL', () => {
    const { url, init } = gemini.buildChatRequest(config, PARAMS);
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain('g-key');
    expect(init.headers['x-goog-api-key']).toBe('g-key');
    const body = JSON.parse(init.body);
    expect(body.systemInstruction.parts[0].text).toBe('sys prompt');
    expect(body.contents[0].parts[0].text).toBe('user prompt');
    expect(body.generationConfig.maxOutputTokens).toBe(512);
  });

  it('disables thinking for 2.5 Flash models only (budget would be eaten by thought tokens)', () => {
    const flash = JSON.parse(gemini.buildChatRequest(config, PARAMS).init.body);
    expect(flash.generationConfig.thinkingConfig).toEqual({ thinkingBudget: 0 });
    const pro = JSON.parse(gemini.buildChatRequest({ ...config, model: 'gemini-2.5-pro' }, PARAMS).init.body);
    expect(pro.generationConfig.thinkingConfig).toBeUndefined();
  });

  it('omits systemInstruction when no system prompt', () => {
    const body = JSON.parse(gemini.buildChatRequest(config, { prompt: 'p' }).init.body);
    expect(body.systemInstruction).toBeUndefined();
  });

  it('parses candidates text and joins parts', () => {
    expect(gemini.parseChatResponse({
      candidates: [{ content: { parts: [{ text: 'foo' }, { text: 'bar' }] } }],
    })).toBe('foobar');
  });

  it('throws on empty response', () => {
    expect(() => gemini.parseChatResponse({ candidates: [] })).toThrow();
    expect(() => gemini.parseChatResponse({})).toThrow();
  });

  it('testConnection lists models stripped of models/ prefix', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'models/gemini-2.5-flash' }, { name: 'models/gemini-2.5-pro' }] }),
    });
    const res = await gemini.testConnection(config);
    expect(res.ok).toBe(true);
    expect(res.models).toEqual(['gemini-2.5-flash', 'gemini-2.5-pro']);
  });
});

describe('anthropicProvider', () => {
  const config = { apiKey: 'sk-ant-x', model: 'claude-opus-4-8' };

  it('builds request with required browser-access headers and no sampling params', () => {
    const { url, init } = anthropic.buildChatRequest(config, PARAMS);
    expect(url).toBe('https://api.anthropic.com/v1/messages');
    expect(init.headers['x-api-key']).toBe('sk-ant-x');
    expect(init.headers['anthropic-version']).toBe('2023-06-01');
    expect(init.headers['anthropic-dangerous-direct-browser-access']).toBe('true');
    const body = JSON.parse(init.body);
    expect(body.model).toBe('claude-opus-4-8');
    expect(body.max_tokens).toBe(512);
    expect(body.system).toBe('sys prompt');
    expect(body.messages).toEqual([{ role: 'user', content: 'user prompt' }]);
    expect(body.temperature).toBeUndefined();
    expect(body.top_p).toBeUndefined();
    expect(body.top_k).toBeUndefined();
  });

  it('parses text blocks', () => {
    expect(anthropic.parseChatResponse({
      stop_reason: 'end_turn',
      content: [{ type: 'text', text: 'hello ' }, { type: 'text', text: 'world' }],
    })).toBe('hello world');
  });

  it('throws on refusal and on empty content', () => {
    expect(() => anthropic.parseChatResponse({ stop_reason: 'refusal', content: [] })).toThrow(/refused/);
    expect(() => anthropic.parseChatResponse({ content: [] })).toThrow(/Empty/);
  });

  it('testConnection surfaces HTTP errors', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: false,
      status: 401,
      text: async () => '{"error":{"message":"invalid x-api-key"}}',
    });
    const res = await anthropic.testConnection(config);
    expect(res.ok).toBe(false);
    expect(res.code).toBe('http');
    expect(res.message).toContain('401');
  });
});

describe('openaiCompatProvider', () => {
  const config = { apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1/' };

  it('normalizes trailing slashes and builds Bearer auth request', () => {
    const { url, init } = openaiCompat.buildChatRequest(config, PARAMS);
    expect(url).toBe('https://api.openai.com/v1/chat/completions');
    expect(init.headers.authorization).toBe('Bearer sk-x');
    const body = JSON.parse(init.body);
    expect(body.messages[0]).toEqual({ role: 'system', content: 'sys prompt' });
    expect(body.messages[1]).toEqual({ role: 'user', content: 'user prompt' });
    expect(body.max_tokens).toBe(512);
  });

  it('omits auth header when no key (self-hosted gateways)', () => {
    const { init } = openaiCompat.buildChatRequest({ ...config, apiKey: '' }, PARAMS);
    expect(init.headers.authorization).toBeUndefined();
  });

  it('parses choices content', () => {
    expect(openaiCompat.parseChatResponse({ choices: [{ message: { content: 'ok' } }] })).toBe('ok');
    expect(() => openaiCompat.parseChatResponse({ choices: [] })).toThrow();
  });

  it('testConnection falls back to a 1-token chat when /models is 404', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'x' } }] }) });
    const res = await openaiCompat.testConnection(config);
    expect(res.ok).toBe(true);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it('testConnection fallback treats HTTP-200 chat as success even with empty content', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({ ok: false, status: 404, text: async () => 'not found' })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: '' } }] }) });
    const res = await openaiCompat.testConnection(config);
    expect(res.ok).toBe(true);
  });

  it('chat retries with max_completion_tokens when max_tokens is rejected', async () => {
    global.fetch = jest.fn()
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        text: async () => "Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead.",
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ choices: [{ message: { content: 'ok' } }] }) });
    const out = await openaiCompat.chat(config, PARAMS);
    expect(out).toBe('ok');
    const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
    const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
    expect(firstBody.max_tokens).toBe(512);
    expect(secondBody.max_completion_tokens).toBe(512);
    expect(secondBody.max_tokens).toBeUndefined();
  });
});

describe('ollamaProvider', () => {
  const config = { apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434' };

  it('builds non-streaming /api/chat request', () => {
    const { url, init } = ollama.buildChatRequest(config, PARAMS);
    expect(url).toBe('http://localhost:11434/api/chat');
    expect(init.headers.authorization).toBeUndefined();
    const body = JSON.parse(init.body);
    expect(body.model).toBe('llama3.2');
    expect(body.stream).toBe(false);
    expect(body.options.num_predict).toBe(512);
    expect(body.messages[0].role).toBe('system');
  });

  it('parses message content', () => {
    expect(ollama.parseChatResponse({ message: { content: 'hi' } })).toBe('hi');
    expect(() => ollama.parseChatResponse({})).toThrow();
  });

  it('testConnection reports code network on fetch TypeError (CORS hint case)', async () => {
    global.fetch = jest.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    const res = await ollama.testConnection(config);
    expect(res.ok).toBe(false);
    expect(res.code).toBe('network');
  });

  it('testConnection lists installed models from /api/tags', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }, { name: 'qwen3' }] }),
    });
    const res = await ollama.testConnection(config);
    expect(res.ok).toBe(true);
    expect(res.models).toEqual(['llama3.2', 'qwen3']);
  });
});

describe('httpUtils.readStreamLines', () => {
  it('splits lines across chunk boundaries, trims CR, skips blanks, flushes the tail', async () => {
    global.fetch = jest.fn().mockResolvedValue(streamResponse([
      'data: one\r\n\n',
      'data: tw', 'o\ndata: tail-no-newline',
    ]));
    const lines = [];
    for await (const line of readStreamLines('https://x/stream', {})) lines.push(line);
    expect(lines).toEqual(['data: one', 'data: two', 'data: tail-no-newline']);
  });

  it('decodes multi-byte UTF-8 characters split across chunks', async () => {
    const bytes = new TextEncoder().encode('午安\n'); // 3 bytes per CJK char
    global.fetch = jest.fn().mockResolvedValue(streamResponse([
      bytes.slice(0, 2), bytes.slice(2), // cut inside 午
    ]));
    const lines = [];
    for await (const line of readStreamLines('https://x/stream', {})) lines.push(line);
    expect(lines).toEqual(['午安']);
  });

  it('throws HttpError with scrubbed body on non-2xx before yielding', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      streamResponse(['bad key sk-abcdefgh12345678'], { ok: false, status: 401 }));
    const gen = readStreamLines('https://x/stream', {});
    await expect(gen.next()).rejects.toMatchObject({ status: 401 });
    await expect(async () => {
      for await (const _ of readStreamLines('https://x/stream', {})) void _;
    }).rejects.toThrow('sk-***');
  });
});

describe('provider streaming (parseStreamLine + chatStream)', () => {
  describe('anthropic', () => {
    const config = { apiKey: 'sk-ant-x', model: 'claude-opus-4-8' };

    it('parseStreamLine extracts text deltas and the stop sentinel', () => {
      expect(anthropic.parseStreamLine('event: content_block_delta')).toBeNull();
      expect(anthropic.parseStreamLine('data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hi"}}'))
        .toEqual({ text: 'Hi' });
      expect(anthropic.parseStreamLine('data: {"type":"content_block_delta","delta":{"type":"input_json_delta","partial_json":"{"}}'))
        .toBeNull();
      expect(anthropic.parseStreamLine('data: {"type":"message_stop"}')).toEqual({ done: true });
      expect(anthropic.parseStreamLine('data: not json')).toBeNull();
      expect(() => anthropic.parseStreamLine('data: {"type":"error","error":{"message":"overloaded"}}'))
        .toThrow(/overloaded/);
    });

    it('chatStream sets stream:true, forwards chunks in order, returns the full text', async () => {
      global.fetch = jest.fn().mockResolvedValue(streamResponse([
        'event: message_start\ndata: {"type":"message_start"}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":"Hello"}}\n\n',
        'data: {"type":"content_block_delta","delta":{"type":"text_delta","text":" world"}}\n\n',
        'data: {"type":"message_stop"}\n\n',
      ]));
      const chunks = [];
      const out = await anthropic.chatStream(config, PARAMS, c => chunks.push(c));
      expect(out).toBe('Hello world');
      expect(chunks).toEqual(['Hello', ' world']);
      const body = JSON.parse(global.fetch.mock.calls[0][1].body);
      expect(body.stream).toBe(true);
    });

    it('chatStream throws on a stream that ends with no text', async () => {
      global.fetch = jest.fn().mockResolvedValue(streamResponse(['data: {"type":"message_stop"}\n']));
      await expect(anthropic.chatStream(config, PARAMS)).rejects.toThrow(/Empty/);
    });
  });

  describe('gemini', () => {
    const config = { apiKey: 'g-key', model: 'gemini-2.5-flash' };

    it('streaming request targets :streamGenerateContent?alt=sse with key in header only', () => {
      const { url, init } = gemini.buildChatRequest(config, { ...PARAMS, stream: true });
      expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?alt=sse');
      expect(url).not.toContain('g-key');
      expect(init.headers['x-goog-api-key']).toBe('g-key');
    });

    it('parseStreamLine joins candidate parts and ignores empty deltas', () => {
      expect(gemini.parseStreamLine('data: {"candidates":[{"content":{"parts":[{"text":"a"},{"text":"b"}]}}]}'))
        .toEqual({ text: 'ab' });
      expect(gemini.parseStreamLine('data: {"candidates":[{"finishReason":"STOP"}]}')).toBeNull();
      expect(gemini.parseStreamLine('random noise')).toBeNull();
    });

    it('chatStream accumulates SSE deltas', async () => {
      global.fetch = jest.fn().mockResolvedValue(streamResponse([
        'data: {"candidates":[{"content":{"parts":[{"text":"One "}]}}]}\n\n',
        'data: {"candidates":[{"content":{"parts":[{"text":"sentence."}]}}]}\n\n',
      ]));
      const chunks = [];
      const out = await gemini.chatStream(config, PARAMS, c => chunks.push(c));
      expect(out).toBe('One sentence.');
      expect(chunks).toEqual(['One ', 'sentence.']);
    });

    it('chatStream surfaces HTTP errors as HttpError', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        streamResponse(['denied'], { ok: false, status: 403 }));
      await expect(gemini.chatStream(config, PARAMS)).rejects.toMatchObject({ status: 403 });
    });
  });

  describe('openaiCompat', () => {
    const config = { apiKey: 'sk-x', model: 'gpt-4o-mini', baseUrl: 'https://api.openai.com/v1' };

    it('parseStreamLine reads delta content and the [DONE] sentinel', () => {
      expect(openaiCompat.parseStreamLine('data: {"choices":[{"delta":{"content":"Hey"}}]}'))
        .toEqual({ text: 'Hey' });
      expect(openaiCompat.parseStreamLine('data: {"choices":[{"delta":{"role":"assistant"}}]}')).toBeNull();
      expect(openaiCompat.parseStreamLine('data: [DONE]')).toEqual({ done: true });
      expect(openaiCompat.parseStreamLine(': keep-alive comment')).toBeNull();
    });

    it('chatStream stops at [DONE] and returns the accumulated text', async () => {
      global.fetch = jest.fn().mockResolvedValue(streamResponse([
        'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n',
        'data: {"choices":[{"delta":{"content":"Str"}}]}\n\ndata: {"choices":[{"delta":{"content":"eam"}}]}\n\n',
        'data: [DONE]\n\n',
      ]));
      const chunks = [];
      const out = await openaiCompat.chatStream(config, PARAMS, c => chunks.push(c));
      expect(out).toBe('Stream');
      expect(chunks).toEqual(['Str', 'eam']);
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).stream).toBe(true);
    });

    it('chatStream retries with max_completion_tokens on the dedicated 400', async () => {
      global.fetch = jest.fn()
        .mockResolvedValueOnce(streamResponse(
          ["Unsupported parameter: 'max_tokens'. Use 'max_completion_tokens' instead."],
          { ok: false, status: 400 }))
        .mockResolvedValueOnce(streamResponse([
          'data: {"choices":[{"delta":{"content":"ok"}}]}\n\ndata: [DONE]\n\n',
        ]));
      const out = await openaiCompat.chatStream(config, PARAMS, () => {});
      expect(out).toBe('ok');
      const firstBody = JSON.parse(global.fetch.mock.calls[0][1].body);
      const secondBody = JSON.parse(global.fetch.mock.calls[1][1].body);
      expect(firstBody.max_tokens).toBe(512);
      expect(secondBody.max_completion_tokens).toBe(512);
      expect(secondBody.max_tokens).toBeUndefined();
      expect(secondBody.stream).toBe(true);
    });
  });

  describe('ollama', () => {
    const config = { apiKey: '', model: 'llama3.2', baseUrl: 'http://localhost:11434' };

    it('parseStreamLine reads NDJSON content and the done flag', () => {
      expect(ollama.parseStreamLine('{"message":{"content":"To"},"done":false}')).toEqual({ text: 'To' });
      expect(ollama.parseStreamLine('{"message":{"content":""},"done":true}')).toEqual({ done: true });
      expect(ollama.parseStreamLine('{"message":{"content":"end"},"done":true}'))
        .toEqual({ text: 'end', done: true });
      expect(ollama.parseStreamLine('not json')).toBeNull();
      expect(() => ollama.parseStreamLine('{"error":"model not found"}')).toThrow(/model not found/);
    });

    it('chatStream sends stream:true and stops at done:true', async () => {
      global.fetch = jest.fn().mockResolvedValue(streamResponse([
        '{"message":{"content":"To"},"done":false}\n{"message":{"content":"ken"},"done":false}\n',
        '{"message":{"content":""},"done":true}\n',
      ]));
      const chunks = [];
      const out = await ollama.chatStream(config, PARAMS, c => chunks.push(c));
      expect(out).toBe('Token');
      expect(chunks).toEqual(['To', 'ken']);
      expect(JSON.parse(global.fetch.mock.calls[0][1].body).stream).toBe(true);
    });
  });
});

describe('httpUtils.normalizeBaseUrl', () => {
  it('trims whitespace and trailing slashes', () => {
    expect(normalizeBaseUrl(' https://x.dev/v1// ')).toBe('https://x.dev/v1');
    expect(normalizeBaseUrl('')).toBe('');
    expect(normalizeBaseUrl(undefined)).toBe('');
  });
});

describe('httpUtils.isInsecureRemoteBaseUrl', () => {
  it('flags cleartext http toward remote hosts', () => {
    expect(isInsecureRemoteBaseUrl('http://my-server.example.com:8080/v1')).toBe(true);
    expect(isInsecureRemoteBaseUrl('http://192.168.1.10:11434')).toBe(true);
  });
  it('exempts local addresses (Ollama default)', () => {
    expect(isInsecureRemoteBaseUrl('http://localhost:11434')).toBe(false);
    expect(isInsecureRemoteBaseUrl('http://127.0.0.1:11434')).toBe(false);
    expect(isInsecureRemoteBaseUrl('http://[::1]:11434')).toBe(false);
    expect(isInsecureRemoteBaseUrl('http://ollama.localhost')).toBe(false);
  });
  it('passes https and unparsable values', () => {
    expect(isInsecureRemoteBaseUrl('https://api.openai.com/v1')).toBe(false);
    expect(isInsecureRemoteBaseUrl('not a url')).toBe(false);
    expect(isInsecureRemoteBaseUrl('')).toBe(false);
  });
});
