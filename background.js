// Hello World GPT - Production Grade Background Engine (v5.1.5)
// Features: 5D Intelligence, DOM-Awareness, Cost Mitigation
console.log('🚀 HWGPT: Background Engine Activated v5.1.5');

// ============================================
// CONFIGURATION
// ============================================

const CONFIG = {
    SUPABASE_URL: 'https://asdkryvlvldcgolthnsq.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFzZGtyeXZsdmxkY2dvbHRobnNxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjIwMTIxMTksImV4cCI6MjA3NzU4ODExOX0.z6WsmU1FU-MY-3MSERzw62zJKPqjvrP9USCBICSZa3s',
    GEMINI_API_KEY: 'AIzaSyBPUpKARzEf5E2BxTuH5M8w4YtnZH-PvcM',

    // Stripe - Hello World GPT Pro Payment Link (Test Mode)
    STRIPE_PAYMENT_LINK: 'https://buy.stripe.com/test_7sY8wPaLZ8Ln8iG2n68Ra00',

    // Free tier limits
    FREE_DAILY_LIMIT: 500,

    // Timeouts
    API_TIMEOUT: 12000, 
    OPTIMIZE_TIMEOUT: 20000, 

    // Version & Model
    VERSION: '6.1.0',
    MODEL: 'gemini-3-flash-preview'
};

const EDGE_FUNCTION_URL = `${CONFIG.SUPABASE_URL}/functions/v1/llm-proxy`;

// FinOps Rates (per 1M tokens) - Gemini 2.5 Flash Lite
const RATES = {
    GEMINI_2_5_FLASH_LITE: { input: 0.05, output: 0.20, cachedInput: 0.01 },
    PREMIUM_MODEL: { input: 5.00, output: 15.00 },
    CIRCUIT_BREAKER: {
        MAX_TOKENS_PER_HOUR: 2000000, // 2M tokens/hour cap
        MAX_COST_PER_SESSION: 1.00     // $1.00 safety valve
    }
};

// ============================================
// STATE & CACHE
// ============================================

let usageCache = {
    count: 0,
    date: null,
    isPro: false,
    tier: 'Free',
    hourlyTokens: 0,
    lastHour: new Date().getHours(),
    sessionCost: 0
};
let contextCache = new Map(); // Local cache for context hashes
let analysisController = null; // Controller to abort previous analysis requests

// ============================================
// OFFSCREEN & PERSISTENCE (MV3 Hardening)
// ============================================

let offscreenCreated = false;

// ============================================
// CDP BRIDGE (CASPER PROTOCOL)
// ============================================

const attachedTabs = new Set();

async function attachCDP(tabId) {
    if (attachedTabs.has(tabId)) return true;
    try {
        await chrome.debugger.attach({ tabId }, "1.3");
        attachedTabs.add(tabId);
        await chrome.debugger.sendCommand({ tabId }, "Accessibility.enable");
        await chrome.debugger.sendCommand({ tabId }, "Runtime.enable");
        console.log(`🛡️ HWGPT: CDP Attached to tab ${tabId}`);
        return true;
    } catch (e) {
        console.warn(`⚠️ HWGPT: CDP Attachment failed for ${tabId}:`, e.message);
        return false;
    }
}

async function sendCDPAction(tabId, method, params) {
    await attachCDP(tabId);
    return await chrome.debugger.sendCommand({ tabId }, method, params);
}

// Memory-Mapped AXTree Extraction (Sovereign Context)
async function getSovereignContext(tabId) {
    try {
        await attachCDP(tabId);
        const { nodes } = await chrome.debugger.sendCommand({ tabId }, "Accessibility.getFullAXTree");
        // Distill AXTree into LLM-ready semantic map
        return nodes.filter(n => n.name?.value || n.role?.value).map(n => ({
            role: n.role?.value,
            name: n.name?.value,
            description: n.description?.value
        })).slice(0, 100);
    } catch (e) {
        return [];
    }
}

async function setupOffscreen() {
    if (offscreenCreated) return;

    try {
        const existing = await chrome.offscreen.hasDocument();
        if (existing) {
            offscreenCreated = true;
            return;
        }

        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['IFRAME_SCRIPTING'],
            justification: 'Maintaining a persistent local LLM session via Prompt API to provide real-time prompt scoring without service worker wake-up latency.'
        });
        offscreenCreated = true;
        console.log('🛡️ HWGPT: Persistent Offscreen session established.');
    } catch (e) {
        console.warn('⚠️ HWGPT: Offscreen creation deferred:', e.message);
    }
}

function getMode(siteContext) {
    const chatPlatforms = [
        'chatgpt.com', 'openai.com', 'gemini.google.com', 'claude.ai', 'anthropic.com',
        'grok.com', 'x.ai', 'meta.ai', 'deepseek.com', 'perplexity.ai', 'poe.com',
        'bing.com', 'microsoft.com', 'you.com', 'phind.com', 'kagi.com', 'huggingface.co',
        'openrouter.ai', 'chatarena.ai', 'msty.app', 'lmstudio.ai', 'ollama.com', 'aistudio.google.com'
    ];
    const writingTools = [
        'docs.google.com', 'mail.google.com', 'notion.so', 'grammarly.com', 'quillbot.com',
        'jasper.ai', 'copy.ai', 'writesonic.com', 'rytr.me', 'sudowrite.com', 'wordtune.com',
        'anyword.com', 'hypotenuse.ai', 'medium.com', 'substack.com', 'ghost.org', 'reddit.com',
        'hubspot.com', 'salesforce.com', 'gong.io', 'intercom.com', 'drift.com', 'zoho.com',
        'linkedin.com', 'twitter.com', 'x.com', 'canva.com', 'framer.com', 'webflow.com'
    ];
    const devTools = [
        'github.com', 'cursor.com', 'cursor.sh', 'replit.com', 'codeium.com',
        'sourcegraph.com', 'cody.dev', 'tabnine.com', 'amazon.com', 'codesandbox.io',
        'stackblitz.com', 'continue.dev', 'jetbrains.com', 'v0.dev', 'lovable.dev', 'bolt.new'
    ];

    const context = siteContext.toLowerCase();
    if (chatPlatforms.some(p => context.includes(p))) return 'prompt-upgrader';
    if (writingTools.some(p => context.includes(p))) return 'writing-assistant';
    if (devTools.some(p => context.includes(p))) return 'dev-tool';

    return 'prompt-upgrader'; // Default
}



// ============================================
// USAGE TRACKING & PRO TIER
// ============================================

// ============================================
// PRIVACY ENGINE (v5.0.2 Blueprint)
// ============================================

class PrivacyPreserver {
    constructor() {
        this.piiMap = new Map();
        this.patterns = {
            email: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            phone: /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,
            creditCard: /\b(?:\d[ -]*?){13,16}\b/g,
            ssn: /\b\d{3}-\d{2}-\d{4}\b/g,
            ipv4: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g
        };
    }

    luhnCheck(number) {
        const digits = number.replace(/\D/g, '');
        let sum = 0;
        let isEven = false;
        for (let i = digits.length - 1; i >= 0; i--) {
            let n = parseInt(digits[i], 10);
            if (isEven) {
                if ((n *= 2) > 9) n -= 9;
            }
            sum += n;
            isEven = !isEven;
        }
        return (sum % 10) === 0;
    }

    scrub(text) {
        let scrubbedText = text;
        const currentPII = {};

        for (const [type, pattern] of Object.entries(this.patterns)) {
            scrubbedText = scrubbedText.replace(pattern, (match) => {
                if (type === 'creditCard' && !this.luhnCheck(match)) return match;

                const placeholder = `[${type.toUpperCase()}_${Math.random().toString(36).substring(2, 5)}]`;
                this.piiMap.set(placeholder, match);
                return placeholder;
            });
        }
        return scrubbedText;
    }

    rehydrate(text) {
        let result = text;
        for (const [placeholder, original] of this.piiMap.entries()) {
            result = result.split(placeholder).join(original);
        }
        return result;
    }
}

// Periodic persistence to avoid storage I/O bottleneck

// Periodic persistence to avoid storage I/O bottleneck
let persistenceTimeout = null;
async function syncUsageToStorage() {
    if (persistenceTimeout) return;
    persistenceTimeout = setTimeout(async () => {
        await chrome.storage.local.set({
            dailyUsage: usageCache.count,
            lastUsageDate: usageCache.date,
            isPro: usageCache.isPro,
            hourlyTokens: usageCache.hourlyTokens,
            lastHour: usageCache.lastHour,
            sessionCost: usageCache.sessionCost
        });
        persistenceTimeout = null;
    }, 10000); // Sync every 10s
}

async function loadUsageState() {
    const today = new Date().toDateString();
    const currentHour = new Date().getHours();

    // If cache is empty or day/hour changed, initialize from storage or reset
    if (!usageCache.date || usageCache.date !== today || usageCache.lastHour !== currentHour) {
        const data = await chrome.storage.local.get(['dailyUsage', 'lastUsageDate', 'isPro', 'proExpiry', 'hourlyTokens', 'lastHour', 'sessionCost', 'tier']);

        const isNewDay = data.lastUsageDate !== today;
        const isNewHour = data.lastHour !== currentHour;

        usageCache = {
            count: isNewDay ? 0 : (data.dailyUsage || 0),
            date: today,
            isPro: data.isPro && data.proExpiry && Date.now() < data.proExpiry,
            tier: data.tier || 'Free',
            hourlyTokens: (isNewDay || isNewHour) ? 0 : (data.hourlyTokens || 0),
            lastHour: currentHour,
            sessionCost: isNewDay ? 0 : (data.sessionCost || 0)
        };

        if (isNewDay || isNewHour) {
            await syncUsageToStorage();
        }
    }
    return usageCache;
}

function canEnhanceSync() {
    // Synchronous memory check for high-performance loops
    const today = new Date().toDateString();
    if (usageCache.date !== today) return { allowed: true };

    let dailyLimit = CONFIG.FREE_DAILY_LIMIT;
    // We skip boostedLimit check here for pure speed, assuming it's merged into dailyLimit or handled elsewhere

    if (usageCache.count >= dailyLimit) {
        return { allowed: usageCache.isPro, reason: 'Daily limit reached' };
    }
    if (usageCache.hourlyTokens >= RATES.CIRCUIT_BREAKER.MAX_TOKENS_PER_HOUR) {
        return { allowed: usageCache.isPro, reason: 'Hourly cap reached' };
    }
    if (usageCache.sessionCost >= RATES.CIRCUIT_BREAKER.MAX_COST_PER_SESSION) {
        return { allowed: usageCache.isPro, reason: 'Session safety triggered' };
    }
    return { allowed: true, remaining: dailyLimit - usageCache.count };
}

async function canEnhance() {
    await loadUsageState(); // Fast memory-first load
    return canEnhanceSync();
}

async function trackUsage(tokens = 0, cost = 0, isAnalysis = false) {
    if (!isAnalysis) usageCache.count++;
    usageCache.hourlyTokens += tokens;
    usageCache.sessionCost += cost;

    // Async storage sync (doesn't block current request)
    syncUsageToStorage();

    return { dailyUsage: usageCache.count, streak: 0, sessionCost: usageCache.sessionCost };
}

// ============================================
// MESSAGE HANDLER
// ============================================

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (!request || !request.action) return;

    // Use a wrapper to handle async responses properly
    const handleMessage = async () => {
        try {
            console.log(`📡 HWGPT: Incoming message [${request.action}] from ${sender.tab?.url || 'popup'}`);

            switch (request.action) {
                case 'optimize':
                    return await handleOptimize(request.text, request.context, request.directive, request.uiLanguage);

                case 'live-analyze':
                    return await liveAnalyze(request.text, request.context, request.chatContext, request.contextHash, request);

                case 'check-usage':
                    return await canEnhance();

                case 'get-pro-status':
                    await loadUsageState();
                    return { isPro: usageCache.isPro };

                case 'set-pro-status':
                    await chrome.storage.local.set({
                        isPro: request.isPro,
                        proExpiry: Date.now() + (30 * 24 * 60 * 60 * 1000)
                    });
                    usageCache.isPro = request.isPro;
                    return { success: true };

                case 'grant-share-boost':
                    const boostData = await chrome.storage.local.get(['boostedLimit', 'boostedLimitDate', 'lastBoostTimestamp']);
                    const now = Date.now();
                    const todayStr = new Date().toDateString();

                    if (boostData.lastBoostTimestamp && (now - boostData.lastBoostTimestamp < 12 * 60 * 60 * 1000)) {
                        return { success: false, error: 'Lockout active' };
                    }

                    const newBoostedLimit = (boostData.boostedLimitDate === todayStr) ? (boostData.boostedLimit || 0) + 5 : 5;
                    await chrome.storage.local.set({
                        boostedLimit: newBoostedLimit,
                        boostedLimitDate: todayStr,
                        lastBoostTimestamp: now
                    });
                    return { success: true, newLimit: CONFIG.FREE_DAILY_LIMIT + newBoostedLimit };

                case 'offscreen-heartbeat':
                    return { alive: true };

                case 'update-context':
                    // Cache the current context for the sidepanel to fetch
                    chrome.storage.local.set({
                        currentContext: {
                            platform: request.platform,
                            hostname: request.hostname,
                            title: request.title,
                            timestamp: Date.now()
                        }
                    });
                    return { success: true };

                case 'ping':
                    return { pong: true };

                default:
                    return { error: 'Unknown action' };
            }
        } catch (e) {
            console.error(`❌ HWGPT: Message handler error [${request.action}]:`, e);
            return { error: e.message || 'Internal error' };
        }
    };

    // Safe sendResponse wrapper to prevent "message channel closed" errors
    const safeSend = (response) => {
        try { sendResponse(response); } catch (e) { /* channel already closed */ }
    };
    handleMessage().then(safeSend).catch((err) => {
        safeSend({ error: err?.message || 'Internal error' });
    });
    return true; // Keep channel open
});

// ============================================
// PORT HANDLER (High-Frequency Messaging)
// ============================================

chrome.runtime.onConnect.addListener((port) => {
    if (port.name !== 'hwgpt-live-port') return;

    port.onMessage.addListener(async (msg) => {
        if (msg.action === 'live-analyze') {
            try {
                // Trigger Autonomous Mode if prefix is 'Agent:'
                if (msg.text?.startsWith('Agent:')) {
                    const task = msg.text.replace(/^Agent:\s*/i, '');
                    runAutonomousTask(task);
                    port.postMessage({ action: 'live-analyze-response', data: { analysis: { score: 100, tip: 'Autonomous Agent Activated...', suggestions: ['Monitoring execution...', 'Stabilizing browser...'] } } });
                    return;
                }
                const result = await liveAnalyze(msg.text, msg.context, msg.chatContext, msg.contextHash, msg);
                port.postMessage({ action: 'live-analyze-response', data: result });
            } catch (e) {
                port.postMessage({ action: 'live-analyze-response', data: { error: e.message } });
            }
        } else if (msg.type === 'A2A_VISION_RECOVERY') {
            try {
                console.log('🔮 HWGPT: Performing A2A Vision Recovery...');
                const screenshot = await captureTab();
                const visionResult = await callVisionReasoning('Find the native AI assistant button (sparkle, magic wand, or "Help me write") in this screenshot. Return only its (x, y) coordinates on a 0-1000 scale as JSON: {"x": N, "y": N}.', screenshot);
                
                // Denormalize coordinates to viewport size (assuming 1440x900 as base or just return for client to adjust)
                port.postMessage({ action: 'A2A_VISION_RECOVERY_RESPONSE', data: visionResult });
            } catch (e) {
                console.error('❌ HWGPT: A2A Vision Recovery failed:', e);
                port.postMessage({ action: 'A2A_VISION_RECOVERY_RESPONSE', data: { error: e.message } });
            }
        }
    });
});

// ============================================
// OPTIMIZE HANDLER WITH USAGE CHECK
// ============================================

async function handleOptimize(text, context, directive = '', uiLanguage = 'en') {
    console.log('🔧 HWGPT: handleOptimize called', { text: text.substring(0, 50), context });

    const usage = await canEnhance();
    console.log('✅ HWGPT: canEnhance result:', usage);

    if (!usage.allowed) {
        console.error('❌ HWGPT: Usage not allowed');
        return {
            error: 'Daily limit reached. Upgrade to Pro for unlimited enhancements.',
            limitReached: true
        };
    }

    try {
        console.log('🚀 HWGPT: Calling optimizeText...');
        const result = await optimizeText(text, context, directive, uiLanguage);
        console.log('✅ HWGPT: optimizeText result:', result);

        if (result.limitReached) {
            usageCache.count = CONFIG.FREE_DAILY_LIMIT;
            await chrome.storage.local.set({ dailyUsage: usageCache.count });
            return result;
        }

        const usageData = await trackUsage();
        result.dailyUsage = usageData.dailyUsage;
        result.neuralStreak = usageData.streak;
        return result;
    } catch (error) {
        console.error('❌ HWGPT: handleOptimize error:', error);
        throw error;
    }
}

// ============================================
// CLOUD API - PROXY
// ============================================

async function callProxy(message, model = 'grok', mode = 'chat', siteContext = '', directive = '', timeout = CONFIG.API_TIMEOUT) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
        const requestBody = {
            message,
            model,
            mode,
            directive,
            stream: false,
            userId: await getUserId(),
            conversationId: 'extension-default',
            enableSemanticMemory: false,
            enableSelfRefinement: false,
            siteContext: siteContext,
            referralCode: null
        };

        const response = await fetch(EDGE_FUNCTION_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY,
                'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Proxy Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        if (data.error) throw new Error(data.error);
        return data;
    } catch (error) {
        clearTimeout(timeoutId);
        const isAbort = error.name === 'AbortError' ||
            error.message?.toLowerCase().includes('abort') ||
            error.message?.toLowerCase().includes('timeout');

        if (isAbort) {
            throw new Error('Request timed out. The AI is taking longer than usual to respond. Please try again in a moment.');
        }
        throw error;
    }
}

// ============================================
// SOVEREIGN VISION: COMPUTER USE ENGINE
// ============================================

async function captureTab() {
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return null;
        
        // Capture as JPEG for lower token cost
        const dataUrl = await chrome.tabs.captureVisibleTab(null, { format: 'jpeg', quality: 50 });
        return dataUrl.split(',')[1]; // Base64 portion only
    } catch (e) {
        console.error('📸 Vision Error:', e);
        return null;
    }
}

async function runAutonomousTask(initialTask) {
    console.log('🤖 HWGPT: Starting Autonomous Hardware-Level Task:', initialTask);
    let stepCount = 0;
    const maxSteps = 15;
    const taskHistory = [];
    
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;
    
    // 0. Attach Casper-grade CDP Bridge
    const tabId = tab.id;
    await attachCDP(tabId);
    
    while (stepCount < maxSteps) {
        const screenshotRaw = await captureTab();
        const vNodes = await getSovereignContext(tabId); // semantic AXTree
        
        // 1. Official Computer Use Vision Call
        const nextAction = await callVisionReasoning(initialTask, screenshotRaw, vNodes, taskHistory);
        console.log('🔮 HWGPT: Next Hardware Action Decision:', nextAction);
        
        if (!nextAction || nextAction.type === 'done' || nextAction.type === 'finish') {
            console.log('✅ HWGPT: Autonomous completion signaled.');
            break;
        }
        
        // 2. Official CDP Physical Actuation turn
        try {
            if (nextAction.x !== undefined && nextAction.y !== undefined) {
                // Denormalize coordinates (Gemini 0-999 scale)
                const x = Math.round(nextAction.x * (tab.width || 1440) / 1000);
                const y = Math.round(nextAction.y * (tab.height || 900) / 1000);
                
                if (nextAction.type === 'click') {
                    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
                    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
                } else if (nextAction.type === 'type') {
                    // Focus first
                    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
                    await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
                    
                    for (const char of (nextAction.value || '')) {
                        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyDown", text: char });
                        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", text: char });
                    }
                    if (nextAction.enter) {
                        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: 13 });
                        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 13 });
                    }
                }
            } else if (nextAction.type === 'navigate') {
                await chrome.tabs.update(tabId, { url: nextAction.value });
            } else if (nextAction.type === 'wait') {
                await new Promise(r => setTimeout(r, nextAction.value || 5000));
            }
        } catch (e) {
            console.error('❌ HWGPT: Hardware actuation failed:', e.message);
        }
        
        taskHistory.push(nextAction);
        stepCount++;
        
        // 3. Stabilization for UI Refresh
        await new Promise(r => setTimeout(r, 2500));
    }
    console.log('🏁 HWGPT: Hardware Task Process Finished.');
}

async function callVisionReasoning(task, screenshot, vNodes, history) {
    const visionPrompt = `You are an Autonomous Web Agent. 
    Goal: ${task}
    
    Previous Actions: ${JSON.stringify(history)}
    
    Use the available computer_use tools to achieve the goal based on the visual state of the browser.`;

    const url = `https://generativelanguage.googleapis.com/v1beta/models/${CONFIG.MODEL}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;
    
    const body = {
        contents: [{
            role: "user",
            parts: [
                { text: visionPrompt },
                { inlineData: { mimeType: "image/jpeg", data: screenshot } }
            ]
        }],
        tools: [
            { 
                computer_use: { 
                    environment: "ENVIRONMENT_BROWSER" 
                } 
            }
        ],
        generationConfig: {
            // responseMimeType is not used when calling tools
            temperature: 0.1
        },
        thinking_config: { include_thoughts: true }
    };

    try {
        const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            const data = await response.json();
            const candidate = data.candidates?.[0];
            const parts = candidate?.content?.parts || [];
            
            // Extract the function call from the parts
            const functionCallPart = parts.find(p => p.function_call);
            if (functionCallPart) {
                const fc = functionCallPart.function_call;
                console.log('🔮 HWGPT: Official Computer Use Action Received:', fc.name, fc.args);
                
                // Map official tool names to our internal LAM engine
                return {
                    type: fc.name === 'click_at' ? 'click' : 
                          fc.name === 'type_text_at' ? 'type' : 
                          fc.name === 'navigate' ? 'navigate' : 
                          fc.name === 'wait_5_seconds' ? 'wait' : fc.name,
                    isVisionResult: true,
                    x: fc.args.x,
                    y: fc.args.y,
                    value: fc.args.text || fc.args.url,
                    enter: fc.args.press_enter || false,
                    reason: parts.find(p => p.text)?.text || 'Executing official tool'
                };
            }
            
            // If no function call, check for a final response text
            const finalNode = parts.find(p => p.text);
            if (finalNode && (finalNode.text.toLowerCase().includes('done') || finalNode.text.toLowerCase().includes('finish'))) {
                return { type: 'done' };
            }
        }
    } catch (e) {
        console.error('❌ Vision API Error:', e);
    }
    return null;
}

// ============================================
// CLOUD API - DIRECT GEMINI
// ============================================

async function callDirectGemini(text, siteContext, isPro = false, directive = '', timeout = CONFIG.OPTIMIZE_TIMEOUT, uiLanguage = 'en') {
    const models = [
        { name: 'gemini-1.5-flash', api: 'v1beta' }
    ];

    const langNames = {
        'hi': 'Hindi', 'es': 'Spanish', 'pt': 'Portuguese', 'ja': 'Japanese',
        'bn': 'Bengali', 'zh': 'Chinese', 'fr': 'French', 'de': 'German',
        'ru': 'Russian', 'it': 'Italian', 'en': 'English'
    };
    const fullLang = langNames[uiLanguage.split('-')[0]] || uiLanguage;

    const mode = getMode(siteContext);
    const enhancePrompt = `You are a prompt optimization expert. Rewrite the user's prompt to be more specific, clear, and effective for AI.

- Keep the original intent and topic
- Add specificity: who, what, format, constraints
- Make it actionable and well-structured
- LANGUAGE REQUIREMENT: Rewrite the 'optimizedText' in the SAME LANGUAGE as the user's input prompt. However, the 'tip' and any other explanation MUST be in the user's UI language: ${fullLang}.
- Return ONLY valid JSON
</constraints>

<task>
Constraint: Respond in ${fullLang}.
Original: "${text.substring(0, 800)}"
Site: ${siteContext}
${directive ? 'Focus area: ' + directive : ''}
Return JSON: {"optimizedText":"the improved prompt","score":N,"tip":"one line about what was improved"}
</task>`;

    for (const model of models) {
        let controller = null;
        let timeoutId = null;
        try {
            controller = new AbortController();
            const currentModel = model;
            timeoutId = setTimeout(() => controller.abort(), timeout);

            console.log(`🚀 HWGPT: Attempting enhancement via ${currentModel.name}...`);
            const url = `https://generativelanguage.googleapis.com/${currentModel.api}/models/${currentModel.name}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

            const body = {
                contents: [{ 
                    role: "user",
                    parts: [{ text: enhancePrompt }] 
                }],
                tools: [
                    { googleSearch: {} },
                    { googleMaps: {} },
                    { urlContext: {} },
                    { fileSearch: {} }
                ],
                toolConfig: {
                    includeServerSideToolInvocations: true
                },
                generationConfig: {
                    maxOutputTokens: isPro ? 800 : 400,
                    temperature: 0.2,
                    responseMimeType: "application/json"
                }
            };

            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                signal: controller.signal,
                body: JSON.stringify(body)
            });

            console.log(`📡 HWGPT: ${currentModel.name} status:`, response.status);

            if (response.ok) {
                const data = await response.json();
                const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                if (responseText) {
                    const parsed = parseAIJSON(responseText);
                    if (parsed && parsed.optimizedText) {
                        clearTimeout(timeoutId);
                        console.log(`✅ HWGPT: Enhancement success with ${currentModel.name}`);
                        return parsed;
                    }
                }
            } else {
                const errData = await response.json().catch(() => ({}));
                console.warn(`⚠️ HWGPT: ${currentModel.name} failed:`, errData.error?.message || response.status);
            }
            if (timeoutId) clearTimeout(timeoutId);
        } catch (e) {
            if (timeoutId) clearTimeout(timeoutId);
            if (e.name === 'AbortError') {
                console.warn(`⚠️ HWGPT: ${model.name} timed out after ${timeout}ms`);
            } else {
                console.warn(`❌ HWGPT: ${model.name} error:`, e.message);
            }
        }
    }
    return null;
}

// ============================================
// LIVE ANALYSIS
// ============================================

async function liveAnalyze(text, siteContext, chatContext = '', contextHash = '', request = {}) {
    const uiLanguage = request.uiLanguage || 'hi'; // Default to hi for this test or use background detection
    console.log(`📡 HWGPT: liveAnalyze processing ${typeof text === 'string' ? text.length : 'ERR'} chars, UI: ${uiLanguage}`);

    // Ensure offscreen persistence is warm
    setupOffscreen();

    if (!text || typeof text !== 'string' || text.length < 1) return { analysis: { score: 0, tip: 'Start typing...', suggestions: [] } };

    let analysisTimeout = null;
    // Research-Aligned Privacy Layer (v5.0.2)
    const privacy = new PrivacyPreserver();
    const scrubbedText = privacy.scrub(text);
    const finalScrubbedChat = privacy.scrub(chatContext);

    // 1. Hardened Daily Limit & Circuit Breaker Check
    const usage = await canEnhance();
    console.log('✅ HWGPT: liveAnalyze usage check:', usage);
    if (!usage.allowed) {
        return {
            analysis: { score: 0, tip: usage.reason || 'Daily limit reached.', suggestions: [] },
            limitReached: true,
            reason: usage.reason,
            metadata: { platformOptimization: 'Limited' }
        };
    }

    const cacheKey = `${contextHash}_${text}`;
    if (contextCache.has(cacheKey)) {
        return {
            analysis: contextCache.get(cacheKey),
            metadata: { platformOptimization: 'Cached', costSaved: '0.0000' }
        };
    }

    try {
        let result = null;

        const mode = getMode(siteContext);

        const langNames = {
            'hi': 'Hindi', 'es': 'Spanish', 'pt': 'Portuguese', 'ja': 'Japanese',
            'bn': 'Bengali', 'zh': 'Chinese', 'fr': 'French', 'de': 'German',
            'ru': 'Russian', 'it': 'Italian', 'en': 'English'
        };
        const fullLang = langNames[uiLanguage.split('-')[0]] || uiLanguage;

        const scorePrompt = `You are a prompt quality analyzer specialized in helping users write better AI prompts. Analyze the user's prompt and provide a score and SPECIFIC, actionable suggestions unique to THIS exact prompt's topic and content.

CRITICAL RULES:
- Every suggestion MUST reference the specific topic/subject of the user's prompt
- NEVER give generic advice like "be more specific" or "add details"
- Each suggestion should tell the user EXACTLY what information to add
- Suggestions must be different from each other
- LANGUAGE REQUIREMENT: You MUST respond in the user's UI language: ${fullLang}. Even if the user prompt is in a different language, the "tip" and "suggestions" fields of your JSON response MUST be in ${fullLang}.

<examples>
Prompt: "suggest me some diet food in BD"
Response: {"score":30,"tip":"Specify dietary preferences like keto, low-carb, or traditional Bangladeshi diet","suggestions":["Mention your health goal: weight loss, diabetes management, or muscle gain","Clarify if you want homemade recipes, restaurant options, or grocery lists","Add calorie target per meal and your food allergies or restrictions"]}

Prompt: "best places to visit in Mumbai or Delhi"
Response: {"score":45,"tip":"Specify your interests: heritage, nightlife, or local street food","suggestions":["Mention if you want a 1-day or 3-day itinerary for Maharashtra or NCR","Add your budget range (budget, luxury) and travel month","Clarify if you want to include nearby spots like Lonavala (Mumbai) or Agra (Delhi)"]}

Prompt: "how to make soft roti"
Response: {"score":35,"tip":"Specify the type of flour (Atta) and the technique you're currently using","suggestions":["Mention if you want tips on dough kneading or the Tawa cooking temperature","Add if you are interested in variants like Phulka, Chapati, or Paratha","Clarify if you are using an open flame or an induction cooktop"]}


Prompt: "recetas de comida mediterránea"
Response: {"score":50,"tip":"Especifique si busca platos de España, Grecia o Italia","suggestions":["Mencione si prefiere ingredientes de temporada (verano vs invierno)","Añada si busca recetas rápidas (<30 min) o tradicionales","Aclare si tiene restricciones como dieta sin gluten o baja en sal"]}

Prompt: "melhores praias do Brasil"
Response: {"score":40,"tip":"Especifique a região: Nordeste, Sudeste ou Sul","suggestions":["Mencione se busca praias badaladas ou desertas e tranquilas","Adicione o período da viagem para evitar a época de chuvas","Esclareça se viaja com família, amigos ou em casal para recomendações de infraestrutura"]}

Prompt: "भारत में घूमने के लिए सबसे अच्छी जगहें"
Response: {"score":45,"tip":"अपनी रुचि बताएं: ऐतिहासिक स्थल, प्रकृति या स्थानीय भोजन","suggestions":["बताएं कि क्या आप उत्तर भारत (हिमालय) या दक्षिण भारत (केरल) की यात्रा करना चाहते हैं","अपना बजट (किफायती, विलासिता) और यात्रा का महीना जोड़ें","स्पष्ट करें कि क्या आप धार्मिक यात्रा या साहसिक यात्रा (एडवेंचर) में रुचि रखते हैं"]}
</examples>

<constraints>
- tip: ONE sentence directly about what specific information is missing from THIS prompt
- suggestions: 2-3 actionable tips that reference the actual topic/subject of the prompt
- Return ONLY valid JSON, no other text
</constraints>

<task>
Constraint: You MUST respond in ${fullLang}.
Prompt: "${scrubbedText.substring(0, 500)}"
Site: ${siteContext}
Return JSON: {"score":N,"tip":"...","suggestions":["...","..."]}
</task>`;

        // Abort any ongoing analysis request
        if (analysisController) {
            analysisController.abort();
        }
        analysisController = new AbortController();
        const localController = analysisController;
        analysisTimeout = setTimeout(() => localController.abort(), 4500); // 4.5s hard limit

        const models = [
            { name: 'gemini-1.5-flash', api: 'v1beta' }
        ];

        for (const model of models) {
            try {
                if (analysisController?.signal.aborted) break;

                console.log(`🚀 HWGPT: Analysis via ${model.name}...`);
                const url = `https://generativelanguage.googleapis.com/${model.api}/models/${model.name}:generateContent?key=${CONFIG.GEMINI_API_KEY}`;

                const body = {
                    contents: [{ 
                        role: "user",
                        parts: [{ text: scorePrompt }] 
                    }],
                    tools: [
                        { googleSearch: {} },
                        { googleMaps: {} },
                        { urlContext: {} },
                        { fileSearch: {} }
                    ],
                    toolConfig: {
                        includeServerSideToolInvocations: true
                    },
                    generationConfig: {
                        responseMimeType: "application/json",
                        temperature: 0.4,
                        maxOutputTokens: 250,
                        candidateCount: 1
                    }
                };

                const response = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    signal: analysisController.signal,
                    body: JSON.stringify(body)
                });

                console.log(`📡 HWGPT: ${model.name} response status:`, response.status);

                if (response.ok) {
                    const data = await response.json();
                    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (responseText) {
                        const parsed = parseAIJSON(responseText);
                        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
                            result = parsed;
                            result.source = model.name;
                            console.log(`✅ HWGPT: Analysis success with ${model.name}`);
                            break;
                        }
                    }
                } else {
                    const errData = await response.json().catch(() => ({}));
                    console.error(`⚠️ HWGPT: ${model.name} failed [${response.status}]:`, JSON.stringify(errData.error || errData));
                }
            } catch (e) {
                if (e.name === 'AbortError') throw e;
                console.warn(`❌ HWGPT: ${model.name} error:`, e.message);
            }
        }

        // Fallback to Proxy if Direct Gemini fails
        if (!result) {
            console.log('⚠️ HWGPT: Direct Gemini failed, falling back to Proxy...');
            try {
                const proxyData = await callProxy(scorePrompt, 'grok', 'analyze', siteContext, '', CONFIG.API_TIMEOUT);
                let rawResult = proxyData.response || proxyData;

                // If the proxy returns a string, parse it
                if (typeof rawResult === 'string') {
                    const parsed = parseAIJSON(rawResult);
                    if (parsed && typeof parsed === 'object') {
                        result = parsed;
                    }
                } else if (rawResult && typeof rawResult === 'object') {
                    result = rawResult;
                }

                // Only add source if result is a valid object
                if (result && typeof result === 'object' && !Array.isArray(result)) {
                    result.source = 'proxy-grok';
                }
            } catch (proxyError) {
                // Silently handle analysis failures (timeouts/aborts) to keep console clean
                const isExpectedAbort = proxyError.name === 'AbortError' ||
                    proxyError.message?.includes('timed out') ||
                    proxyError.message?.includes('aborted');

                if (!isExpectedAbort) {
                    console.error('❌ HWGPT: Analysis failed:', proxyError.message || proxyError);
                }
            }
        }

        if (result) {
            const jargon = ['sft', 'llm', 'token', 'system prompt', 'inference', 'backtrack', 'cot', 'tot'];
            const clean = (str) => {
                let cleaned = str;
                jargon.forEach(j => {
                    const reg = new RegExp(`\\b${j}\\b`, 'gi');
                    cleaned = cleaned.replace(reg, '');
                });
                return cleaned.replace(/\s+/g, ' ').trim();
            };

            if (result.tip) result.tip = clean(result.tip);
            if (result.suggestions) {
                result.suggestions = result.suggestions.map(s => clean(s)).filter(s => s.length > 0);
            }

            contextCache.set(cacheKey, result);
            // Keep cache to 100 entries (longer retention)
            if (contextCache.size > 100) contextCache.delete(contextCache.keys().next().value);
        }

        // Dynamic fallback based on the actual prompt text content & topic
        if (!result) {
            const words = text.split(/\s+/).filter(Boolean);
            const wordCount = words.length;
            const lower = text.toLowerCase();
            const dynamicTips = [];

            // Detect topic from prompt keywords
            const topicMap = [
                {
                    keys: ['diet', 'food', 'eat', 'nutrition', 'meal', 'recipe', 'cook', 'calorie'], tips: [
                        'Specify dietary preferences (vegetarian, keto, halal, gluten-free, etc.).',
                        'Mention your budget range or calorie target per meal.',
                        'Clarify if you want local dishes, homemade, or restaurant options.',
                        'Add health goals like weight loss, muscle gain, or balanced nutrition.'
                    ]
                },
                {
                    keys: ['university', 'college', 'school', 'education', 'study', 'course', 'degree'], tips: [
                        'Specify your field of study or academic interest.',
                        'Mention budget, location preference, or scholarship requirements.',
                        'Clarify undergraduate, graduate, or PhD level.',
                        'Add criteria like ranking, campus life, or research opportunities.'
                    ]
                },
                {
                    keys: ['travel', 'trip', 'visit', 'tour', 'hotel', 'flight', 'destination'], tips: [
                        'Mention your travel dates, budget, and group size.',
                        'Specify the type of experience: adventure, relaxation, culture.',
                        'Clarify if you need visa, hotel, or full itinerary suggestions.',
                        'Add any dietary or accessibility requirements.'
                    ]
                },
                {
                    keys: ['code', 'program', 'function', 'bug', 'error', 'api', 'database', 'software'], tips: [
                        'Specify the programming language and version.',
                        'Include error messages or expected vs actual behavior.',
                        'Mention the framework or environment you\'re using.',
                        'Add constraints like performance, security, or compatibility needs.'
                    ]
                },
                {
                    keys: ['market', 'business', 'startup', 'revenue', 'customer', 'brand', 'strategy'], tips: [
                        'Define your target market, audience size, or demographics.',
                        'Specify your budget, timeline, or business stage.',
                        'Mention competitors or industry context.',
                        'Clarify success metrics: revenue, users, or engagement.'
                    ]
                },
                {
                    keys: ['health', 'doctor', 'medicine', 'exercise', 'workout', 'fitness', 'symptom'], tips: [
                        'Mention your age, fitness level, or health conditions.',
                        'Specify your goal: weight loss, strength, or recovery.',
                        'Clarify if you want exercises, diet plans, or medical info.',
                        'Add time constraints (e.g., 15-min workouts, weekly plans).'
                    ]
                },
                {
                    keys: ['write', 'essay', 'blog', 'article', 'story', 'content', 'copy'], tips: [
                        'Specify the tone: formal, casual, persuasive, or academic.',
                        'Mention word count, format, and target audience.',
                        'Add the key message or thesis you want to convey.',
                        'Clarify if you need SEO optimization or keyword inclusion.'
                    ]
                },
                {
                    keys: ['design', 'ui', 'ux', 'color', 'layout', 'logo', 'figma'], tips: [
                        'Specify the platform: web, mobile, print, or social media.',
                        'Mention your brand colors, style preferences, or audience.',
                        'Clarify deliverables: mockup, wireframe, or production-ready.',
                        'Reference examples of styles you like.'
                    ]
                },
                {
                    keys: ['invest', 'stock', 'finance', 'money', 'budget', 'saving', 'crypto'], tips: [
                        'Specify your risk tolerance and investment timeline.',
                        'Clarify your financial goal: retirement, savings, or income.',
                        'Add geographic context for tax or regulation relevance.',
                        'Mention your current portfolio size or experience level.'
                    ]
                },
                {
                    keys: ['email', 'letter', 'message', 'reply', 'respond', 'draft'], tips: [
                        'Specify the tone: professional, friendly, urgent, or apologetic.',
                        'Mention the recipient and your relationship context.',
                        'Clarify the key action you want the recipient to take.',
                        'Add length preference: brief, detailed, or bullet points.'
                    ]
                },
                {
                    keys: ['image', 'photo', 'video', 'edit', 'draw', 'illustration'], tips: [
                        'Specify resolution, aspect ratio, or file format needed.',
                        'Describe the style: realistic, cartoon, minimalist, etc.',
                        'Mention the purpose: social media, presentation, or print.',
                        'Add color palette or mood preferences.'
                    ]
                }
            ];

            // Find matching topic and add its tips
            let matched = false;
            for (const { keys, tips } of topicMap) {
                if (keys.some(k => lower.includes(k))) {
                    dynamicTips.push(...tips);
                    matched = true;
                    break;
                }
            }

            // Add structural analysis tips based on what's missing
            const hasFormat = /\b(list|table|paragraph|step.?by.?step|json|summary|outline)\b/i.test(text);
            const hasAudience = /\b(beginner|expert|student|professional|child|developer)\b/i.test(text);
            const hasConstraints = /\b(must|should|only|at least|maximum|minimum|limit|avoid)\b/i.test(text);
            const hasContext = /\b(because|since|given that|as a|for my|background|situation)\b/i.test(text);
            const hasExamples = /\b(example|such as|like|e\.g|for instance|similar to)\b/i.test(text);

            if (!matched) {
                // Generic but still varied based on what's missing
                if (wordCount < 8) dynamicTips.push(`Your prompt is brief (${wordCount} words). Add more specific details.`);
                if (!hasFormat) dynamicTips.push('Specify your desired output format (list, step-by-step, table, etc.).');
                if (!hasAudience) dynamicTips.push('Define your target audience or expertise level.');
                if (!hasConstraints) dynamicTips.push('Add constraints (word count, budget, timeframe) to focus the response.');
                if (!hasContext) dynamicTips.push('Add context about your situation for more relevant answers.');
                if (!hasExamples) dynamicTips.push('Include examples of what you\'re looking for.');
            } else {
                // Add 1-2 structural tips even for topic-matched prompts
                if (!hasFormat && dynamicTips.length < 5) dynamicTips.push('Specify your desired output format (list, table, step-by-step, etc.).');
                if (!hasContext && dynamicTips.length < 5) dynamicTips.push('Add more context about your specific situation.');
            }

            result = {
                score: Math.min(55, Math.max(15, wordCount * 5 + (text.includes('?') ? 10 : 0))),
                tip: dynamicTips[0] || 'Add more detail to your prompt for better AI responses.',
                suggestions: dynamicTips.slice(1, 4)
            };
        }

        const metrics = calculateCostMetrics(text, result?.suggestions?.join(' ') || '', result?.score || 50, contextHash !== '');
        if (result) result.metrics = metrics;

        // Track usage with actual tokens and cost (Analysis mode - doesn't count against daily limit)
        await trackUsage(metrics.totalTokens, parseFloat(metrics.actualCost), true);

        return {
            analysis: result,
            limitReached: false,
            mode: mode,
            tier: usageCache.tier,
            metadata: {
                platformOptimization: result?.source || 'Basic',
                metrics: metrics,
                contextCached: contextHash !== ''
            }
        };
    } catch (error) {
        if (error.name === 'AbortError') return { aborted: true, analysis: null };
        console.error('❌ HWGPT: Analysis pipeline failed:', error);
        // Always return a valid analysis object to prevent UI errors
        return {
            analysis: {
                score: 40,
                tip: 'AI analysis temporarily unavailable. Keep refining!',
                suggestions: ['Try rephrasing your prompt', 'Check your internet connection']
            },
            limitReached: false,
            error: error.message
        };
    } finally {
        if (analysisTimeout) clearTimeout(analysisTimeout);
    }
}

function calculateCostMetrics(inputText, outputText, score = 90, isContextCached = false) {
    const inputTokens = Math.ceil(inputText.length / 4);
    const outputTokens = Math.ceil(outputText.length / 4);
    const totalTokens = inputTokens + outputTokens;

    const premiumCost = (inputTokens / 1000000 * RATES.PREMIUM_MODEL.input) + (outputTokens / 1000000 * RATES.PREMIUM_MODEL.output);
    const inputRate = isContextCached ? RATES.GEMINI_2_5_FLASH_LITE.cachedInput : RATES.GEMINI_2_5_FLASH_LITE.input;
    const actualCost = (inputTokens / 1000000 * inputRate) + (outputTokens / 1000000 * RATES.GEMINI_2_5_FLASH_LITE.output);

    const savings = Math.max(0, premiumCost - actualCost);

    // Move 5: Impossible Metric - Intelligence per Dollar
    const intelligencePerDollar = actualCost > 0 ? (score / actualCost).toFixed(0) : '∞';

    return {
        actualCost: actualCost.toFixed(6),
        savings: savings.toFixed(6),
        inputTokens,
        outputTokens,
        totalTokens,
        intelligencePerDollar,
        attribution: `HGPT-Lite-v5.1 (${isContextCached ? 'Cached' : 'Direct'})`
    };
}

function parseAIJSON(text) {
    if (!text) return null;
    try {
        // Step 1: Clean markdown blocks and excessive whitespace
        let cleaned = text.replace(/```json|```/g, '').trim();

        // Step 2: Extract the first balanced JSON object
        let firstBrace = cleaned.indexOf('{');
        let lastBrace = cleaned.lastIndexOf('}');

        if (firstBrace === -1) return null;

        // If we have a balanced pair, try that first
        if (lastBrace > firstBrace) {
            const candidate = cleaned.substring(firstBrace, lastBrace + 1);
            try {
                return JSON.parse(candidate);
            } catch (e) {
                // Keep going if balanced parse fails
            }
        }

        // Step 3: Greedy salvage for truncated JSON
        // Try to find the last valid comma or closing bracket and close it manually
        let salvage = cleaned.substring(firstBrace);
        const stack = [];
        let cutPoint = -1;

        for (let i = 0; i < salvage.length; i++) {
            const char = salvage[i];
            if (char === '{') stack.push('{');
            else if (char === '}') {
                if (stack.length > 0) stack.pop();
                if (stack.length === 0) {
                    cutPoint = i;
                    break;
                }
            }
        }

        if (cutPoint !== -1) {
            try {
                return JSON.parse(salvage.substring(0, cutPoint + 1));
            } catch (e) { }
        }

        // Final attempt: aggressive cleaning of trailing junk
        try {
            // Remove trailing commas before closing braces
            const fixed = salvage.substring(0, cutPoint !== -1 ? cutPoint + 1 : salvage.length)
                .replace(/,\s*([}\]])/g, '$1');
            return JSON.parse(fixed);
        } catch (e) {
            console.warn('💎 HWGPT: JSON Parse totally failed.');
        }

        return null;
    } catch (e) {
        console.warn('💎 HWGPT: JSON Parse error:', e.message);
        return null;
    }
}

// ============================================
// MAIN OPTIMIZATION ENGINE
// ============================================

async function optimizeText(text, siteContext, directive = '', uiLanguage = 'en') {
    console.log('🔧 HWGPT: optimizeText called', { textLength: text.length });

    // Research-Aligned Privacy Layer (v5.0.2)
    const privacy = new PrivacyPreserver();
    const scrubbedText = privacy.scrub(text);

    let resultData = null;
    await loadUsageState();
    const isPro = usageCache.isPro;

    try {
        if (!resultData) {
            resultData = await callDirectGemini(scrubbedText, siteContext, isPro, directive, CONFIG.OPTIMIZE_TIMEOUT, uiLanguage);
        }

        if (!resultData || (isPro && resultData.score < 80)) {
            try {
                const data = await callProxy(scrubbedText, 'grok', 'enhance', siteContext, directive, CONFIG.OPTIMIZE_TIMEOUT);

                if (data.limitReached) return { limitReached: true, error: data.error };
                const proxyResponse = data.response || data;
                if (typeof proxyResponse === 'string') {
                    resultData = { optimizedText: proxyResponse, score: 95, tip: 'Enterprise-grade optimization applied.' };
                } else {
                    resultData = proxyResponse;
                }
            } catch (e) {
                console.warn('⚠️ HWGPT: Proxy fallback failed');
            }
        }

        if (resultData && resultData.optimizedText) {
            resultData.optimizedText = privacy.rehydrate(resultData.optimizedText);
        }

        let optimizedText = resultData?.optimizedText || text;
        if (optimizedText) {
            optimizedText = optimizedText
                .replace(/^```[\s\S]*?```$/gm, '')
                .replace(/^["']|["']$/g, '')
                .replace(/^(Enhanced prompt:|Improved prompt:|Here's the improved prompt:)/i, '')
                .trim();

            const histData = await chrome.storage.local.get(['history']);
            const history = histData.history || [];
            history.push({
                original: text,
                enhanced: optimizedText,
                timestamp: Date.now(),
                context: siteContext,
                isPro: isPro,
                score: resultData?.score || 90
            });
            await chrome.storage.local.set({ history: history.slice(-100) });
        }

        const metrics = calculateCostMetrics(text, optimizedText, resultData?.score || 90);
        await trackUsage(metrics.totalTokens, parseFloat(metrics.actualCost));

        return {
            optimizedText: optimizedText,
            score: resultData?.score || 90,
            tip: resultData?.tip || 'Refined for maximum impact.',
            metadata: {
                platformOptimization: 'Enhanced',
                tier: isPro ? 'pro' : 'free',
                metrics: metrics,
                privacyApplied: true
            },
            metrics: metrics
        };
    } catch (error) {
        console.error('❌ HWGPT: Optimization critical failure:', error);
        return {
            optimizedText: text,
            score: 50,
            tip: 'Safety bypass activated. Using original text.',
            error: error.message
        };
    }
}

// ============================================
// SUPABASE AUTH
// ============================================

/**
 * Sign in with email/password via Supabase Auth
 */
async function handleAuthSignIn(email, password) {
    try {
        const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=password`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error_description || data.msg || 'Sign in failed' };
        }

        // Store auth tokens and user info
        await chrome.storage.local.set({
            supabaseAccessToken: data.access_token,
            supabaseRefreshToken: data.refresh_token,
            supabaseUserId: data.user.id,
            supabaseEmail: data.user.email,
            authExpiresAt: Date.now() + (data.expires_in * 1000)
        });

        console.log('✅ HWGPT: Signed in as', data.user.email);

        // Immediately sync subscription status
        await syncSubscriptionStatus();

        return {
            success: true,
            user: { id: data.user.id, email: data.user.email },
            isPro: usageCache.isPro
        };
    } catch (error) {
        console.error('❌ HWGPT: Sign in error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign up with email/password via Supabase Auth
 */
async function handleAuthSignUp(email, password) {
    try {
        const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (!response.ok) {
            return { success: false, error: data.error_description || data.msg || 'Sign up failed' };
        }

        // If email confirmation is required
        if (!data.access_token) {
            return { success: true, message: 'Check your email to confirm your account' };
        }

        // Auto sign-in after signup
        await chrome.storage.local.set({
            supabaseAccessToken: data.access_token,
            supabaseRefreshToken: data.refresh_token,
            supabaseUserId: data.user.id,
            supabaseEmail: data.user.email,
            authExpiresAt: Date.now() + (data.expires_in * 1000)
        });

        console.log('✅ HWGPT: Signed up as', data.user.email);

        return {
            success: true,
            user: { id: data.user.id, email: data.user.email }
        };
    } catch (error) {
        console.error('❌ HWGPT: Sign up error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Sign out - clear auth tokens
 */
async function handleAuthSignOut() {
    try {
        const { supabaseAccessToken } = await chrome.storage.local.get(['supabaseAccessToken']);

        if (supabaseAccessToken) {
            // Call Supabase logout endpoint
            await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/logout`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${supabaseAccessToken}`,
                    'apikey': CONFIG.SUPABASE_ANON_KEY
                }
            });
        }

        // Clear auth data
        await chrome.storage.local.remove([
            'supabaseAccessToken',
            'supabaseRefreshToken',
            'supabaseUserId',
            'supabaseEmail',
            'authExpiresAt',
            'isPro',
            'proExpiry',
            'tier'
        ]);

        usageCache.isPro = false;
        usageCache.tier = 'Free';

        console.log('✅ HWGPT: Signed out');
        return { success: true };
    } catch (error) {
        console.error('❌ HWGPT: Sign out error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get current authenticated user
 */
async function getAuthUser() {
    try {
        const data = await chrome.storage.local.get([
            'supabaseUserId',
            'supabaseEmail',
            'supabaseAccessToken',
            'authExpiresAt',
            'isPro',
            'tier'
        ]);

        if (!data.supabaseAccessToken) {
            return { success: true, user: null };
        }

        // Check if token is expired
        if (data.authExpiresAt && Date.now() > data.authExpiresAt) {
            // Try to refresh token
            const refreshed = await refreshAuthToken();
            if (!refreshed) {
                return { success: true, user: null };
            }
        }

        return {
            success: true,
            user: {
                id: data.supabaseUserId,
                email: data.supabaseEmail
            },
            isPro: data.isPro || false,
            tier: data.tier || 'Free'
        };
    } catch (error) {
        console.error('❌ HWGPT: Get user error:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Refresh auth token if expired
 */
async function refreshAuthToken() {
    try {
        const { supabaseRefreshToken } = await chrome.storage.local.get(['supabaseRefreshToken']);

        if (!supabaseRefreshToken) return false;

        const response = await fetch(`${CONFIG.SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'apikey': CONFIG.SUPABASE_ANON_KEY
            },
            body: JSON.stringify({ refresh_token: supabaseRefreshToken })
        });

        if (!response.ok) {
            await handleAuthSignOut();
            return false;
        }

        const data = await response.json();

        await chrome.storage.local.set({
            supabaseAccessToken: data.access_token,
            supabaseRefreshToken: data.refresh_token,
            authExpiresAt: Date.now() + (data.expires_in * 1000)
        });

        return true;
    } catch (error) {
        console.error('❌ HWGPT: Token refresh error:', error);
        return false;
    }
}

// ============================================
// SUBSCRIPTION SYNC
// ============================================

/**
 * Syncs subscription status from Supabase to Chrome extension
 * This ensures users who pay through Stripe get Pro benefits immediately
 */
async function syncSubscriptionStatus() {
    try {
        const { supabaseUserId, supabaseEmail, userId, userEmail } = await chrome.storage.local.get(['supabaseUserId', 'supabaseEmail', 'userId', 'userEmail']);

        // Use either supabaseEmail or userEmail for lookup
        const emailToCheck = supabaseEmail || userEmail;

        console.log('🔄 HWGPT: Syncing subscription status...');
        console.log('   supabaseUserId:', supabaseUserId);
        console.log('   userId:', userId);
        console.log('   email:', emailToCheck);

        let response;
        let customers = [];

        // Try 1: Check by Supabase user ID (UUID)
        if (supabaseUserId) {
            response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/customers?supabase_user_id=eq.${supabaseUserId}&select=*`, {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                }
            });
            if (response.ok) {
                customers = await response.json();
            }
        }

        // Try 2: If no results and we have email, check by email
        if (customers.length === 0 && emailToCheck) {
            console.log('   Trying email lookup:', emailToCheck);
            response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/customers?email=eq.${encodeURIComponent(emailToCheck)}&select=*`, {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                }
            });
            if (response.ok) {
                customers = await response.json();
                console.log('   Email lookup result:', customers.length, 'customers found');
            }
        }

        // Try 3: Check by extension userId in extension_user_id column
        if (customers.length === 0 && userId) {
            response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/customers?extension_user_id=eq.${userId}&select=*`, {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                }
            });

            if (response.ok) {
                customers = await response.json();
            }
        }

        // Try 4: Check by extension userId in supabase_user_id column (for UUID userIds)
        if (customers.length === 0 && userId) {
            response = await fetch(`${CONFIG.SUPABASE_URL}/rest/v1/customers?supabase_user_id=eq.${userId}&select=*`, {
                headers: {
                    'apikey': CONFIG.SUPABASE_ANON_KEY,
                    'Authorization': `Bearer ${CONFIG.SUPABASE_ANON_KEY}`
                }
            });

            if (response.ok) {
                customers = await response.json();
            }
        }

        if (!response || !response.ok) {
            console.warn('⚠️ HWGPT: Failed to fetch subscription status');
            return;
        }

        if (customers && customers.length > 0) {
            const customer = customers[0];
            const isActive = customer.subscription_status === 'active';
            const planId = customer.plan_id || 'free';

            // Determine if user has Pro access
            const isPro = isActive && (planId !== 'free');

            // Calculate expiry (30 days from current period end)
            let proExpiry = null;
            if (isPro && customer.current_period_end) {
                proExpiry = new Date(customer.current_period_end).getTime();
            }

            // Update extension storage
            await chrome.storage.local.set({
                isPro: isPro,
                proExpiry: proExpiry,
                tier: isPro ? 'Pro' : 'Free',
                planId: planId,
                lastSyncTimestamp: Date.now()
            });

            // Update cache
            usageCache.isPro = isPro;
            usageCache.tier = isPro ? 'Pro' : 'Free';

            console.log(`✅ HWGPT: Subscription synced - isPro: ${isPro}, tier: ${isPro ? 'Pro' : 'Free'}`);
        } else {
            console.log('ℹ️ HWGPT: No customer record found, user is on free tier');
        }
    } catch (error) {
        console.error('❌ HWGPT: Subscription sync error:', error);
    }
}

/**
 * Links the extension to a Supabase user account
 * This should be called when user logs in or after payment
 */
async function linkSupabaseUser(userId, email) {
    await chrome.storage.local.set({
        supabaseUserId: userId,
        supabaseEmail: email
    });

    // Immediately sync subscription status
    await syncSubscriptionStatus();

    console.log(`✅ HWGPT: Linked to Supabase user: ${email}`);
}

// ============================================
// EXTENSION LIFECYCLE
// ============================================

// Global Message Router (A2A Bridge)
chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.type === 'A2A_VISION_RECOVERY') {
        (async () => {
             // Find current port to send streaming status updates to sidepanel
             try {
                console.log('🔮 HWGPT: Global A2A Recovery Triggered via Vision.');
                
                // Advanced Self-Healing Loop
                const screenshot = await captureTab();
                
                const visionPrompt = `Identify the exact pixel coordinates of the NATIVE AI interface on this webpage. 
                Focus on:
                - The "Sparkle" or "Magic Wand" icon.
                - The "Help me write" pill in Google Docs/Gmail.
                - The "Ask Gemini" input field at bottom right or in sidepanel.
                Return only JSON: {"x": N, "y": N}`;
                
                const visionResult = await callVisionReasoning(visionPrompt, screenshot);
                
                if (visionResult && visionResult.x && visionResult.y) {
                    const tabId = sender.tab.id;
                    const url = sender.tab.url || '';
                    
                    // Hardware-Level Delegation
                    if (url.includes('docs.google.com') || url.includes('mail.google.com')) {
                        console.log('🤝 HWGPT: Enforcing Hardened Workspace Delegation...');
                        await delegateToWorkspaceAI(tabId, visionResult, msg.prompt);
                    } else {
                        console.log(`🎯 HWGPT: Physical CDP Click at [${visionResult.x}, ${visionResult.y}]`);
                        await dispatchPhysicalClick(tabId, visionResult.x, visionResult.y, sender.tab);
                    }
                    
                    sendResponse({ success: true, action: visionResult });
                } else {
                    sendResponse({ error: 'No AI button identified in vision turn.' });
                }
            } catch (e) {
                console.error('❌ HWGPT: A2A Vision Failure:', e);
                sendResponse({ error: e.message });
            }
        })();
        return true; 
    }
});

async function dispatchPhysicalClick(tabId, rx, ry, tab) {
    const x = Math.round(rx * (tab.width || 1440) / 1000);
    const y = Math.round(ry * (tab.height || 900) / 1000);
    
    console.log(`🔎 [A2A-DIAGNOSTIC] Physical Click Mapping:
        - Raw Normalized: [${rx}, ${ry}]
        - Viewport Size: [${tab.width || 1440}x${tab.height || 900}]
        - Computed Pixels: [${x}, ${y}]`);
        
    await attachCDP(tabId);
    
    try {
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        console.log(`✅ [A2A-DIAGNOSTIC] CDP MouseEvent Dispatched Successfully to tab ${tabId}`);
    } catch (e) {
        console.error(`❌ [A2A-DIAGNOSTIC] CDP MouseEvent FAILED:`, e.message);
        throw e;
    }
}

async function delegateToWorkspaceAI(tabId, coords, prompt) {
    console.log(`🤝 [A2A-DIAGNOSTIC] Starting Hardened Workspace Delegation:
        - Tab ID: ${tabId}
        - Prompt Length: ${prompt?.length || 0} chars
        - Target Coords: [${coords.x}, ${coords.y}]`);
        
    await attachCDP(tabId);
    
    // 1. Precise Physical Click
    const x = Math.round(coords.x * 1440 / 1000); 
    const y = Math.round(coords.y * 900 / 1000);
    
    try {
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mousePressed", x, y, button: "left", clickCount: 1 });
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchMouseEvent", { type: "mouseReleased", x, y, button: "left", clickCount: 1 });
        console.log(`🔘 [A2A-DIAGNOSTIC] Workspace AI Bubble Clicked.`);
    } catch (e) {
        console.error(`❌ [A2A-DIAGNOSTIC] Workspace Bubble Click FAILED:`, e.message);
    }
    
    // 2. Wait for Google UI Stabilization
    console.log(`⏳ [A2A-DIAGNOSTIC] Waiting 1500ms for Workspace UI to stabilize...`);
    await new Promise(r => setTimeout(r, 1500));
    
    // 3. Hardware Prompt Injection (Real-Time Ghost Typing)
    console.log(`🔡 [A2A-DIAGNOSTIC] Initiating Real-Time Hardware-Buffer Injection...`);
    try {
        for (const char of prompt || '') {
            await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyDown", text: char });
            await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", text: char });
            
            // Artificial delay for human-like visual typing & buffer stabilization
            await new Promise(r => setTimeout(r, 35));
        }
        console.log(`✨ [A2A-DIAGNOSTIC] Real-Time Injection COMPLETE.`);
        
        // 4. Press Enter to generate
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyDown", windowsVirtualKeyCode: 13 });
        await chrome.debugger.sendCommand({ tabId }, "Input.dispatchKeyEvent", { type: "keyUp", windowsVirtualKeyCode: 13 });
        console.log(`🚀 [A2A-DIAGNOSTIC] Virtual 'Enter' key dispatched. Native generation should start now.`);
    } catch (e) {
        console.error(`❌ [A2A-DIAGNOSTIC] Hardware Injection FAILED:`, e.message);
    }
}

chrome.runtime.onInstalled.addListener(async (details) => {
    if (details.reason === 'install') {
        await chrome.storage.local.set({
            dailyUsage: 0,
            totalEnhancements: 0,
            lastUsageDate: new Date().toDateString(),
            isPro: false,
            settings: { autoAnalyze: true, showBadge: true },
            history: [],
            installTimestamp: Date.now(),
            supabaseUserId: null,
            supabaseEmail: null
        });
        console.log('💎 HWGPT: Extension installed!');
    }

    // Sync subscription status on install/update
    await syncSubscriptionStatus();
});

async function getUserId() {
    const data = await chrome.storage.local.get(['userId']);
    if (data.userId) return data.userId;
    const newId = 'user_' + Math.random().toString(36).substr(2, 9);
    await chrome.storage.local.set({ userId: newId });
    return newId;
}



chrome.runtime.onStartup.addListener(async () => {
    console.log('💎 HWGPT: Extension started');

    // Sync subscription status on startup
    await syncSubscriptionStatus();
});

// Periodic subscription sync (every 5 minutes)
setInterval(async () => {
    await syncSubscriptionStatus();
}, 5 * 60 * 1000);
