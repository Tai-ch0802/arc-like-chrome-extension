/**
 * AI Manager Module
 * Encapsulates interactions with the local window.ai (Gemini Nano) model.
 */
import * as api from './apiManager.js';

/**
 * Checks if the LanguageModel is available and ready.
 * @returns {Promise<boolean>}
 */
export async function checkModelReadiness() {
    // Chrome has recently updated the Prompt API to use the global `LanguageModel` object
    // instead of `window.ai` or `self.ai`.
    if (typeof globalThis !== 'undefined' && globalThis.LanguageModel) {
        try {
            // Note: API updated to use `availability()` instead of `capabilities()`
            const status = await globalThis.LanguageModel.availability();
            // Expected returns: 'readily', 'after-download', 'downloading', or 'no'
            if (status === 'no') {
                return false;
            }
            return true;
        } catch (e) {
            console.warn('AI availability check failed', e);
            return false;
        }
    }
    return false;
}

/**
 * Generates tab groupings based on their titles and URLs.
 * @param {Array<{id: number, title: string, url: string}>} tabsInfo
 * @returns {Promise<Array<{theme: string, tabIds: number[]}>>}
 */
export async function generateGroups(tabsInfo) {
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

    try {
        let session;
        // The capabilities check is already done in checkModelReadiness, but if we want to be extra safe
        // const capabilities = await globalThis.LanguageModel.capabilities();

        const options = {
            systemPrompt: `You are a helpful assistant that strictly outputs JSON arrays based on the requested format. Do NOT use markdown code blocks like \`\`\`json or \`\`\`. You MUST format the JSON correctly and translate the theme names into the ${currentLang} locale language.`,
            temperature: 0.1,
            topK: 1,
            // Follow Chrome built-in AI API guidelines for Language Assignment
            // We specify "en" for the system prompt and currentLang for user prompt and expected output
            expectedInputs: [
                { type: "text", languages: ["en"] }
            ],
            expectedOutputs: [
                { type: "text", languages: ["en"] }
            ]
        };
        // Chrome sometimes requires these options depending on the version
        session = await globalThis.LanguageModel.create(options);

        const result = await session.prompt(prompt);
        session.destroy();

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
    } catch (err) {
        console.error('AI grouping prompt failed:', err);
    }

    // Fallback if parsing fails or an error is thrown
    return [{
        theme: api.getMessage('unknownCategory') || "📦 未知分類",
        tabIds: processingTabs.map(t => t.id)
    }];
}
