import * as anthropic from '../../modules/ai/providers/anthropicProvider.js';
import * as gemini from '../../modules/ai/providers/geminiProvider.js';
import * as openaiCompat from '../../modules/ai/providers/openaiCompatProvider.js';

/**
 * Diagnostic: feed a REALISTIC provider SSE stream through the real chatStream,
 * delivered in tiny awkward byte chunks (splitting multi-byte chars AND lines),
 * and assert the full text is accumulated — reproducing the reported truncation.
 */
function byteStreamResponse(fullText, chunkBytes = 3) {
  const bytes = new TextEncoder().encode(fullText);
  let pos = 0;
  return {
    ok: true,
    status: 200,
    text: async () => fullText,
    body: {
      getReader: () => ({
        read: async () => {
          if (pos >= bytes.length) return { done: true, value: undefined };
          const end = Math.min(pos + chunkBytes, bytes.length);
          const slice = bytes.slice(pos, end);
          pos = end;
          return { done: false, value: slice };
        },
        cancel: async () => { pos = bytes.length; },
      }),
    },
  };
}

const SUMMARY = '方案（包括個人、專業與企業版）以及各自的價格與功能比較。';

afterEach(() => { delete global.fetch; });

test('anthropic realistic SSE (message_start/ping/deltas/stop) is not truncated', async () => {
  const deltas = ['方案（包括', '個人、專業', '與企業版）', '以及各自的', '價格與功能比較。'];
  let sse = 'event: message_start\ndata: {"type":"message_start","message":{"id":"x"}}\n\n';
  sse += 'event: content_block_start\ndata: {"type":"content_block_start","index":0,"content_block":{"type":"text","text":""}}\n\n';
  sse += 'event: ping\ndata: {"type":"ping"}\n\n';
  for (const d of deltas) {
    sse += `event: content_block_delta\ndata: {"type":"content_block_delta","index":0,"delta":{"type":"text_delta","text":${JSON.stringify(d)}}}\n\n`;
  }
  sse += 'event: content_block_stop\ndata: {"type":"content_block_stop","index":0}\n\n';
  sse += 'event: message_delta\ndata: {"type":"message_delta","delta":{"stop_reason":"end_turn"}}\n\n';
  sse += 'event: message_stop\ndata: {"type":"message_stop"}\n\n';

  global.fetch = jest.fn().mockResolvedValue(byteStreamResponse(sse, 3));
  const chunks = [];
  const out = await anthropic.chatStream({ apiKey: 'sk-ant', model: 'claude-opus-4-8' },
    { system: 's', prompt: 'p', maxTokens: 200 }, (c) => chunks.push(c));
  expect(out).toBe(SUMMARY);
});

test('gemini realistic alt=sse deltas are not truncated', async () => {
  const deltas = ['方案（包括', '個人、專業', '與企業版）', '以及各自的', '價格與功能比較。'];
  let sse = '';
  for (const d of deltas) {
    sse += `data: {"candidates":[{"content":{"parts":[{"text":${JSON.stringify(d)}}],"role":"model"}}]}\n\n`;
  }
  global.fetch = jest.fn().mockResolvedValue(byteStreamResponse(sse, 3));
  const out = await gemini.chatStream({ apiKey: 'g', model: 'gemini-2.5-flash' },
    { system: 's', prompt: 'p', maxTokens: 200 }, () => {});
  expect(out).toBe(SUMMARY);
});

test('openai realistic SSE deltas + [DONE] are not truncated', async () => {
  const deltas = ['方案（包括', '個人、專業', '與企業版）', '以及各自的', '價格與功能比較。'];
  let sse = 'data: {"choices":[{"delta":{"role":"assistant"}}]}\n\n';
  for (const d of deltas) {
    sse += `data: {"choices":[{"delta":{"content":${JSON.stringify(d)}}}]}\n\n`;
  }
  sse += 'data: [DONE]\n\n';
  global.fetch = jest.fn().mockResolvedValue(byteStreamResponse(sse, 3));
  const out = await openaiCompat.chatStream({ apiKey: 'sk', model: 'gpt', baseUrl: 'https://api.openai.com/v1' },
    { system: 's', prompt: 'p', maxTokens: 200 }, () => {});
  expect(out).toBe(SUMMARY);
});
