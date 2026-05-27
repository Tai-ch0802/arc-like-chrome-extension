/**
 * AI Manager Module
 * Encapsulates interactions with the local AI models:
 * - LanguageModel (Prompt API) for tab grouping
 * - Summarizer API for page summarization
 */
import * as api from './apiManager.js';

// === Shared Constants ===

/** Supported output languages for Summarizer API (Chrome 140+) */
const SUMMARIZER_SUPPORTED_LANGS = ['en', 'es', 'ja'];

/**
 * Shared LanguageModel options for Prompt API.
 * ⚠️ Best Practice: Always pass the SAME options to both `availability()` and `create()`
 * to align model language and modality capabilities.
 * @see https://developer.chrome.com/docs/ai/inform-users-of-model-download
 */
const LANGUAGE_MODEL_OPTIONS = {
    expectedInputs: [
        { type: 'text', languages: ['en'] }
    ],
    expectedOutputs: [
        { type: 'text', languages: ['en'] }
    ]
};

/**
 * Builds Summarizer options that align between `availability()` and `create()`.
 * @returns {{expectedInputLanguages: string[], outputLanguage: string}}
 */
function _buildSummarizerLangOptions() {
    const userLang = api.getResolvedUILanguage();
    const outputLang = SUMMARIZER_SUPPORTED_LANGS.includes(userLang)
        ? userLang
        : 'en';
    return {
        expectedInputLanguages: ['en', 'ja', 'es'],
        outputLanguage: outputLang,
    };
}

// === Summarizer API (Hover Summarize) ===

/** @type {Summarizer|null} Lazily created and cached session */
let summarizerSession = null;

/**
 * Checks if the Summarizer API is available.
 * @returns {Promise<boolean>}
 */
export async function checkSummarizerReadiness() {
    if (!('Summarizer' in self)) return false;
    try {
        // ⚠️ Best Practice: Pass the same language options to availability()
        // that will be used in create() to ensure correct capability alignment.
        const langOpts = _buildSummarizerLangOptions();
        const status = await Summarizer.availability(langOpts);
        return status !== 'unavailable';
    } catch (e) {
        console.warn('Summarizer availability check failed', e);
        return false;
    }
}

/**
 * Gets or lazily creates a Summarizer session.
 * Uses the user's UI language if supported, otherwise falls back to English.
 * @param {{onProgress?: (loaded: number) => void}} [callbacks] - Optional callbacks for download progress
 * @returns {Promise<Summarizer|null>}
 */
export async function getOrCreateSummarizerSession(callbacks = {}) {
    // Return cached session if available
    if (summarizerSession) return summarizerSession;

    if (!('Summarizer' in self)) return null;

    // ⚠️ Best Practice: Use the same language options for both availability() and create()
    const langOpts = _buildSummarizerLangOptions();

    const availability = await Summarizer.availability(langOpts);
    if (availability === 'unavailable') return null;

    try {
        summarizerSession = await Summarizer.create({
            type: 'tldr',
            format: 'plain-text',
            length: 'short',
            ...langOpts,
            sharedContext: 'Summarize web page content for a browser sidebar tooltip. Keep it very concise, one sentence maximum.',
            monitor(m) {
                m.addEventListener('downloadprogress', (e) => {
                    if (callbacks.onProgress) {
                        callbacks.onProgress(e.loaded);
                    }
                });
            }
        });
        return summarizerSession;
    } catch (err) {
        console.warn('Failed to create Summarizer session:', err);
        return null;
    }
}

/**
 * Destroys the cached Summarizer session (e.g., when settings change).
 */
export function destroySummarizerSession() {
    if (summarizerSession) {
        try { summarizerSession.destroy(); } catch { /* ignore */ }
        summarizerSession = null;
    }
}

/**
 * One-shot summarize. Non-streaming variant for callers that just want the
 * final text (reading list summary memory). Stricter than checkSummarizerReadiness:
 * `'available'` only, so we don't silently kick off a model download from a
 * background event (chrome.readingList.onEntryAdded).
 *
 * @param {string} text
 * @param {string} [domain] - Adds host context to the model prompt.
 * @returns {Promise<string|null>}
 */
export async function summarizeText(text, domain = '') {
    if (!text || typeof text !== 'string') return null;
    if (!('Summarizer' in self)) return null;
    try {
        const langOpts = _buildSummarizerLangOptions();
        const availability = await Summarizer.availability(langOpts);
        if (availability !== 'available') return null;
    } catch {
        return null;
    }
    const session = await getOrCreateSummarizerSession();
    if (!session) return null;
    try {
        const result = await session.summarize(text, {
            context: domain
                ? `Web page from ${domain}. Provide a concise one-sentence summary.`
                : 'Provide a concise one-sentence summary.',
        });
        const out = (result || '').trim();
        return out || null;
    } catch (err) {
        console.warn('[ai] summarizeText failed:', err);
        return null;
    }
}

// === LanguageModel API (Tab Grouping) ===

/** @type {LanguageModel|null} Lazily created and cached session */
let languageModelSession = null;

/**
 * Checks the LanguageModel availability and returns the detailed status.
 * @returns {Promise<string>} 'available', 'downloadable', 'downloading', or 'unavailable'
 */
export async function checkModelAvailability() {
    if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) {
        try {
            const status = await globalThis.LanguageModel.availability(LANGUAGE_MODEL_OPTIONS);
            return status || 'unavailable';
        } catch (e) {
            console.warn('AI availability check failed', e);
            return 'unavailable';
        }
    }
    return 'unavailable';
}

/**
 * Checks if the LanguageModel is available and ready.
 * @returns {Promise<boolean>}
 */
export async function checkModelReadiness() {
    const status = await checkModelAvailability();
    return status !== 'unavailable';
}

/**
 * Gets or lazily creates a LanguageModel session (cached).
 * Mirrors the Summarizer's lazy session pattern.
 * @param {{onProgress?: (loaded: number) => void}} [callbacks] - Optional download progress callback
 * @returns {Promise<LanguageModel>}
 */
async function getOrCreateLanguageModelSession(callbacks = {}) {
    if (languageModelSession) {
        console.info('[AI] Reusing cached LanguageModel session');
        return languageModelSession;
    }

    console.info('[AI] Creating new LanguageModel session...');
    const currentLang = api.getResolvedUILanguage();

    const options = {
        systemPrompt: `You are a helpful assistant that strictly outputs JSON arrays based on the requested format. Do NOT use markdown code blocks like \`\`\`json or \`\`\`. You MUST format the JSON correctly and translate the theme names into the ${currentLang} locale language.`,
        temperature: 0.1,
        topK: 1,
        // ⚠️ Best Practice: Use the shared LANGUAGE_MODEL_OPTIONS constant
        // and monitor callback for download progress notification.
        ...LANGUAGE_MODEL_OPTIONS,
        monitor(m) {
            console.info('[AI] Monitor callback invoked, registering downloadprogress listener');
            m.addEventListener('downloadprogress', (e) => {
                console.info('[AI] downloadprogress event:', { loaded: e.loaded, total: e.total });
                if (callbacks.onProgress) {
                    callbacks.onProgress(e.loaded);
                }
            });
        }
    };

    languageModelSession = await globalThis.LanguageModel.create(options);
    console.info('[AI] LanguageModel session created successfully');
    return languageModelSession;
}

/**
 * Destroys the cached LanguageModel session (e.g., when model is purged or settings change).
 */
export function destroyLanguageModelSession() {
    if (languageModelSession) {
        try { languageModelSession.destroy(); } catch { /* ignore */ }
        languageModelSession = null;
    }
}

/**
 * Triggers LanguageModel session creation (and thus model download if needed).
 * The created session is cached for later use by generateGroups().
 * @param {{onProgress?: (loaded: number) => void}} [callbacks]
 * @returns {Promise<void>}
 */
export async function triggerLanguageModelDownload(callbacks = {}) {
    await getOrCreateLanguageModelSession(callbacks);
}

/** @type {LanguageModel|null} Dedicated session for runPrompt / NL search */
let nlLanguageModelSession = null;

async function getOrCreateNlSession() {
    if (nlLanguageModelSession) return nlLanguageModelSession;
    if ((await checkModelAvailability()) !== 'available') return null;
    try {
        nlLanguageModelSession = await globalThis.LanguageModel.create({
            // Intentionally neutral — generic JSON-output assistant. The shared
            // grouping session's systemPrompt mentions "theme names" which is
            // tab-grouping specific and could bias unrelated rerank tasks.
            systemPrompt: 'You are a helpful assistant. Output ONLY valid JSON arrays as instructed. Do not use markdown code blocks like ```json or ```.',
            temperature: 0.1,
            topK: 1,
            ...LANGUAGE_MODEL_OPTIONS,
        });
        return nlLanguageModelSession;
    } catch (err) {
        console.warn('[ai] failed to create NL session:', err);
        nlLanguageModelSession = null;
        return null;
    }
}

function destroyNlSession() {
    if (nlLanguageModelSession) {
        try { nlLanguageModelSession.destroy(); } catch { /* ignore */ }
        nlLanguageModelSession = null;
    }
}

/**
 * One-shot prompt for tasks unrelated to tab grouping (NL search, etc.).
 * Strict on availability (`=== 'available'` only) so callers triggered from
 * non-user-initiated contexts can't silently start a multi-GB download.
 *
 * Uses a DEDICATED session — separate from the tab-grouping session — so
 * the grouping-specific systemPrompt doesn't bleed into unrelated tasks
 * and concurrent `prompt()` calls can't interfere on the same session.
 *
 * @param {string} promptText
 * @returns {Promise<string|null>}
 */
export async function runPrompt(promptText) {
    if (!promptText) return null;
    if ((await checkModelAvailability()) !== 'available') return null;
    try {
        const session = await getOrCreateNlSession();
        if (!session) return null;
        return await session.prompt(promptText);
    } catch (err) {
        console.warn('[ai] runPrompt failed:', err);
        destroyNlSession();
        return null;
    }
}

/**
 * Generates tab groupings based on their titles and URLs.
 * Includes retry logic for model lifecycle resilience (mid-session failure).
 * @param {Array<{id: number, title: string, url: string}>} tabsInfo
 * @param {{onProgress?: (loaded: number) => void}} [callbacks] - Optional callbacks for download progress
 * @returns {Promise<Array<{theme: string, tabIds: number[]}>>}
 */
export async function generateGroups(tabsInfo, callbacks = {}) {
    if (!(await checkModelReadiness())) {
        throw new Error(api.getMessage('aiModelNotReady'));
    }

    // Limit to top 30 tabs to avoid token limit overflow (as per SA)
    const MAX_TABS = 30;
    const processingTabs = tabsInfo.slice(0, MAX_TABS);

    // We shouldn't send very long URLs, clean them up or truncate
    const cleanTabs = processingTabs.map(t => {
        let cleanUrl = t.url;
        try {
            const urlObj = new URL(t.url);
            cleanUrl = urlObj.hostname + urlObj.pathname; // strip query params to save tokens
            if (cleanUrl.length > 100) cleanUrl = cleanUrl.substring(0, 100) + '...';
        } catch (e) { }
        let cleanTitle = t.title || 'No Title';
        if (cleanTitle.length > 60) cleanTitle = cleanTitle.substring(0, 60) + '...';
        return { id: t.id, title: cleanTitle, url: cleanUrl };
    });

    const tabsData = cleanTabs.map(t => `ID: ${t.id} | Title: ${t.title} | URL: ${t.url}`).join('\n');

    const currentLang = api.getResolvedUILanguage();

    // We use a strictly formatted prompt
    const prompt = `You are a professional tab organization assistant. Please classify the following list of tabs into 3 to 5 groups based on semantics.
Assign a suitable Emoji and a short theme name for each group. 
CRITICAL: The theme name MUST be in the locale language '${currentLang}'.
Please reply strictly in JSON array format, the format must be exactly as follows (no markdown format, no extra text):
[
  { "theme": "🛠️ <Group Name in ${currentLang}>", "tabIds": [12, 15] }
]

[Tab List]
${tabsData}`;

    // Retry logic: if the first attempt fails (e.g., model purged mid-session),
    // destroy the cached session and try once more.
    // @see https://developer.chrome.com/docs/ai/understand-built-in-model-management
    const MAX_RETRIES = 1;
    for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        try {
            const session = await getOrCreateLanguageModelSession(callbacks);
            const result = await session.prompt(prompt);

            // Try extracting JSON using regex if markdown code blocks or extra text are present
            const jsonMatch = result.match(/\[\s*\{.*?\}\s*\]/s);
            let jsonStr = jsonMatch ? jsonMatch[0] : result;

            try {
                const parsed = JSON.parse(jsonStr);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    return parsed;
                }
            } catch (parseErr) {
                console.error('Failed to parse AI output as JSON:', jsonStr, parseErr);
            }
            // If parsing fails, fall through to the fallback below
            break;
        } catch (err) {
            console.error(`AI grouping prompt failed (attempt ${attempt + 1}):`, err);

            // Model may have been purged or updated mid-session.
            // Destroy the cached session and retry once.
            destroyLanguageModelSession();

            if (attempt < MAX_RETRIES) {
                console.info('Retrying with a fresh session...');
                continue;
            }
            // All retries exhausted, fall through to fallback
        }
    }

    // Fallback if parsing fails or all retries exhausted
    return [{
        theme: api.getMessage('unknownCategory') || "📦 未知分類",
        tabIds: processingTabs.map(t => t.id)
    }];
}

/**
 * Generates a concise group name ("Emoji + ShortName") for a freshly-created tab group.
 * Reuses the shared LanguageModel session (whose systemPrompt enforces JSON output),
 * so we ask the model to reply with a JSON array carrying a single `label` field.
 * @param {Array<{title: string, url: string}>} tabsInfo - Tabs in the new group.
 * @returns {Promise<string|null>} The label "<Emoji> <ShortName>" or null on failure / AI unavailable.
 */
export async function generateGroupName(tabsInfo) {
    if (!Array.isArray(tabsInfo) || tabsInfo.length === 0) return null;
    // Stricter than checkModelReadiness: skip 'downloadable'/'downloading'.
    // Naming runs in the background — we must not silently kick off a multi-GB
    // download. Wait until the user explicitly triggers Smart Auto-Grouping.
    if ((await checkModelAvailability()) !== 'available') return null;

    const MAX_TABS = 10; // Group rarely has >10 tabs; cap for token budget
    const sample = tabsInfo.slice(0, MAX_TABS).map(t => {
        let cleanUrl = t.url || '';
        try {
            const u = new URL(cleanUrl);
            cleanUrl = u.hostname + u.pathname;
            if (cleanUrl.length > 80) cleanUrl = cleanUrl.substring(0, 80) + '...';
        } catch { /* ignore non-URL */ }
        let cleanTitle = t.title || 'No Title';
        if (cleanTitle.length > 60) cleanTitle = cleanTitle.substring(0, 60) + '...';
        return { title: cleanTitle, url: cleanUrl };
    });
    const tabsData = sample.map(t => `Title: ${t.title} | URL: ${t.url}`).join('\n');
    const currentLang = api.getResolvedUILanguage();

    const prompt = `You are a tab group naming assistant. Generate ONE concise label for the following tabs.
Reply strictly in JSON array format (no markdown, no extra text):
[
  { "label": "<Emoji> <ShortName in locale '${currentLang}', max 15 chars>" }
]

[Tabs]
${tabsData}`;

    try {
        const session = await getOrCreateLanguageModelSession();
        const result = await session.prompt(prompt);
        const jsonMatch = result.match(/\[\s*\{[\s\S]*?\}\s*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
        const label = Array.isArray(parsed) && parsed[0] && typeof parsed[0].label === 'string'
            ? parsed[0].label.trim()
            : null;
        return label || null;
    } catch (err) {
        console.warn('[AI] generateGroupName failed:', err);
        destroyLanguageModelSession();
        return null;
    }
}

/**
 * Asks the model which tabs are good cleanup candidates and why.
 * @param {Array<{id: number, title: string, url: string, lastAccessedMinutesAgo: number}>} tabsInfo
 * @returns {Promise<Array<{tabId: number, reason: string}>>} Empty array if AI declines, unavailable, or parsing fails.
 */
export async function generateCleanupSuggestions(tabsInfo) {
    if (!Array.isArray(tabsInfo) || tabsInfo.length === 0) return [];
    if (!(await checkModelReadiness())) return [];

    const MAX_TABS = 30;
    const sample = tabsInfo.slice(0, MAX_TABS).map(t => {
        let cleanUrl = t.url || '';
        try {
            const u = new URL(cleanUrl);
            cleanUrl = u.hostname + u.pathname;
            if (cleanUrl.length > 80) cleanUrl = cleanUrl.substring(0, 80) + '...';
        } catch { /* ignore */ }
        let cleanTitle = t.title || 'No Title';
        if (cleanTitle.length > 60) cleanTitle = cleanTitle.substring(0, 60) + '...';
        return { id: t.id, title: cleanTitle, url: cleanUrl, idleMin: t.lastAccessedMinutesAgo };
    });
    const tabsData = sample
        .map(t => `ID: ${t.id} | Title: ${t.title} | URL: ${t.url} | LastAccessedMinutesAgo: ${t.idleMin}`)
        .join('\n');
    const currentLang = api.getResolvedUILanguage();

    const prompt = `You are a tab cleanup advisor. From the list below, identify tabs that the user can safely close.
Criteria to consider:
- LastAccessedMinutesAgo is large (e.g., > 60 minutes) AND content seems non-essential
- Multiple tabs cover the same topic or duplicate URL
- Tab appears to be a finished task (e.g., "Sign in" pages, completed search results)
Be conservative — when in doubt, skip the tab.

Reply strictly in JSON array format (no markdown, no extra text). Reasons MUST be in locale '${currentLang}', max 30 chars:
[
  { "tabId": 12, "reason": "<short reason in ${currentLang}>" }
]

If no tab is a good candidate, reply with: []

[Tabs]
${tabsData}`;

    try {
        const session = await getOrCreateLanguageModelSession();
        const result = await session.prompt(prompt);
        const jsonMatch = result.match(/\[[\s\S]*\]/);
        const parsed = JSON.parse(jsonMatch ? jsonMatch[0] : result);
        if (!Array.isArray(parsed)) return [];
        return parsed
            .filter(p => p && typeof p.tabId === 'number' && typeof p.reason === 'string')
            .map(p => ({ tabId: p.tabId, reason: p.reason.trim().slice(0, 40) }));
    } catch (err) {
        console.warn('[AI] generateCleanupSuggestions failed:', err);
        destroyLanguageModelSession();
        return [];
    }
}
