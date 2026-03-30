/**
 * Hello World GPT - AI PERSISTENCE ENGINE
 * Maintains a "warm" session with on-device LLM (Gemini Nano)
 * to bypass Service Worker wake-up latency.
 */

// Initialize Gemini Nano (window.ai and window.model are experimental Prompt API)
let session = null;

async function initSession() {
    try {
        if (window.ai && window.ai.assistant) {
            session = await window.ai.assistant.create();
            console.log('🚀 HWGPT: Offscreen - Gemini Nano session stabilized.');
        }
    } catch (e) {
        console.warn('⚠️ HWGPT: Offscreen - Prompt API not available or failed:', e.message);
    }
}

// Keep-alive heartbeat
setInterval(() => {
    if (chrome.runtime?.id) {
        chrome.runtime.sendMessage({ action: 'offscreen-heartbeat' });
    }
}, 20000);

// Unified listener for high-frequency analysis
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'analyze-local' && session) {
        (async () => {
            try {
                const result = await session.prompt(request.text);
                sendResponse({ response: result });
            } catch (e) {
                sendResponse({ error: e.message });
            }
        })();
        return true;
    }
});

initSession();
