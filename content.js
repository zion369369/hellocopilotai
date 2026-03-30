// Hello Copilot — Browser Layer Content Engine (v6.0.0)
// Architecture: DOM-Aware Intelligence, Zero-Friction Overlays, Cross-Tab Memory
(function () {
    const isOrphaned = () => {
        try {
            return !chrome.runtime?.id || !chrome.runtime?.getManifest();
        } catch (e) {
            return true;
        }
    };

    class HWGPT_Pro_Engine {
        constructor() {
            if (window.HWGPT_INIT_V5_6 && document.getElementById('hwgpt-pro-root')) return;
            window.HWGPT_INIT_V5_6 = true;

            this.config = {
                threshold: 85,
                accent: '#007AFF',
                isDarkMode: false,
                autoAnalyze: true,
                showBadge: true
            };

            this.state = {
                isEnhancing: false,
                lastText: '',
                activeElement: null,
                destroyed: false,
                suggestions: [],
                isMinimized: false,
                lastEnhancedText: '',
                lastAnalyzedText: '',
                lastRawText: '',
                platform: 'generic',
                cachedChatContext: '',
                lastContextScrape: 0,
                cachedContextHash: '',
                customOffset: { x: -28, y: -28 },
                isDragging: false,
                lastAnalysis: null,
                popupOffset: { x: 0, y: 0 },
                selectedSuggestion: null,
                lastEnhancedScore: 0,
                ignoreNextInput: false,
                postEnhanceMode: false
            };

            this.port = null;
            this.observedElements = new Set();

            // PHASE 1: INP HARDENING — Offload Worker Bridge
            this.analysisWorker = null;
            this.workerCallbackMap = new Map();
            this.workerCallId = 0;
            this._initWorker();

            this.init();
        }

        // ═══ PHASE 1: Worker Bridge (INP < 200ms) ═══
        _initWorker() {
            try {
                const workerUrl = chrome.runtime.getURL('workers/analysis-worker.js');
                this.analysisWorker = new Worker(workerUrl);
                this.analysisWorker.onmessage = (e) => {
                    const { id, result } = e.data;
                    const cb = this.workerCallbackMap.get(id);
                    if (cb) {
                        cb(result);
                        this.workerCallbackMap.delete(id);
                    }
                };
                console.log('[PERF] Analysis Worker spawned for INP hardening.');
            } catch (e) {
                console.warn('[PERF] Worker unavailable, falling back to main thread:', e.message);
            }
        }

        _workerCall(type, payload) {
            return new Promise((resolve) => {
                if (!this.analysisWorker) {
                    // Fallback: run on main thread
                    resolve(null);
                    return;
                }
                const id = ++this.workerCallId;
                this.workerCallbackMap.set(id, resolve);
                this.analysisWorker.postMessage({ type, payload, id });
                // Safety timeout: 500ms max
                setTimeout(() => {
                    if (this.workerCallbackMap.has(id)) {
                        this.workerCallbackMap.delete(id);
                        resolve(null);
                    }
                }, 500);
            });
        }

        setupPort() {
            if (this.port || isOrphaned()) return;
            try {
                this.port = chrome.runtime.connect({ name: 'hwgpt-live-port' });
                this.port.onDisconnect.addListener(() => {
                    this.port = null;
                    console.log('🔌 HWGPT: Port disconnected. Will reconnect on next call.');
                });
            } catch (e) {
                this.port = null;
            }
        }

        async callExtension(action, data = {}, retries = 1) {
            if (this.state.destroyed) return null;
            if (isOrphaned()) {
                this.destroy();
                return null;
            }

            // High-frequency calls use the persistent port
            if (action === 'live-analyze') {
                this.setupPort();
                if (this.port) {
                    try {
                        this.port.postMessage({ action, ...data });
                        return new Promise((resolve) => {
                            const handler = (msg) => {
                                if (msg.action === 'live-analyze-response') {
                                    this.port.onMessage.removeListener(handler);
                                    resolve(msg.data);
                                }
                            };
                            this.port.onMessage.addListener(handler);
                            // Safety timeout
                            setTimeout(() => {
                                try { this.port.onMessage.removeListener(handler); } catch (e) { }
                                resolve(null);
                            }, 5000);
                        });
                    } catch (e) {
                        this.port = null;
                    }
                }
            }

            return new Promise((resolve) => {
                const attempt = (remaining) => {
                    try {
                        chrome.runtime.sendMessage({ action, ...data }, (response) => {
                            if (chrome.runtime.lastError) {
                                const errMsg = chrome.runtime.lastError.message || '';
                                if (errMsg.includes('context invalidated')) {
                                    this.destroy();
                                    resolve(null);
                                    return;
                                }
                                if (remaining > 0) {
                                    setTimeout(() => attempt(remaining - 1), 50);
                                    return;
                                }
                            }
                            resolve(response);
                        });
                    } catch (e) {
                        if (e.message?.includes('context invalidated')) this.destroy();
                        resolve(null);
                    }
                };
                attempt(retries);
            });
        }

        destroy() {
            if (this.state.destroyed) return;
            this.state.destroyed = true;

            // CRITICAL: Disconnect observer to prevent memory leaks as per MV3 standards
            if (this.observer) this.observer.disconnect();

            // Remove selection listener
            if (this.selectionHandler) {
                document.removeEventListener('selectionchange', this.selectionHandler);
            }

            // Clear intervals
            if (this.rescueInterval) clearInterval(this.rescueInterval);

            // Remove UI
            const host = document.getElementById('hwgpt-pro-root');
            if (host) host.remove();
            window.HWGPT_INIT_V5_6 = false;

            console.log('🛡️ HWGPT: Engine decommissioned. Resources purged.');
        }

        init() {
            if (!document.body) {
                setTimeout(() => this.init(), 100);
                return;
            }
            this.detectContext();

            // Skip full initialization on non-AI chatbot sites
            // (e.g., Facebook Messenger, WhatsApp Web, Slack, Discord, etc.)
            if (!this.isAIChatbotSite()) {
                console.log('💤 HWGPT: Non-AI site detected, extension inactive on', window.location.hostname);
                return;
            }

            this.createShadowDOM();
            this.startObservation();
            this.setupListeners();
            this.programmaticBoost();

            // Rescue Loop: Verify UI integrity every 5s
            this.rescueInterval = setInterval(() => {
                if (!document.getElementById('hwgpt-pro-root') && !this.state.destroyed) {
                    console.warn('🚑 HWGPT: UI Lost. Rescuing...');
                    this.createShadowDOM();
                }
            }, 5000);

            console.log('💎 HWGPT: Engine Initialized v5.2 (Resilient)');
        }

        // ═══════════════════════════════════════════════════════════════
        // AI CHATBOT SITE WHITELIST
        // The extension should ONLY activate on known AI chatbot sites.
        // This prevents the prompt icon from appearing on messaging apps
        // like Facebook Messenger, WhatsApp Web, Slack, Discord, etc.
        // ═══════════════════════════════════════════════════════════════
        isAIChatbotSite() {
            const hostname = window.location.hostname;
            const aiSites = [
                // OpenAI / ChatGPT
                'chatgpt.com', 'chat.openai.com', 'openai.com',
                // Google AI
                'gemini.google.com', 'aistudio.google.com', 'notebooklm.google.com',
                // Anthropic / Claude
                'claude.ai',
                // xAI / Grok
                'grok.com', 'x.ai',
                // Perplexity
                'perplexity.ai',
                // Mistral
                'chat.mistral.ai', 'mistral.ai',
                // Copilot / Bing
                'copilot.microsoft.com', 'bing.com',
                // Manus AI
                'manus.im',
                // v0
                'v0.dev', 'v0.app',
                // DeepSeek
                'chat.deepseek.com', 'deepseek.com',
                // Poe
                'poe.com',
                // HuggingChat
                'huggingface.co',
                // You.com
                'you.com',
                // Cohere
                'coral.cohere.com', 'cohere.com',
                // Pi / Inflection
                'pi.ai',
                // Jasper
                'jasper.ai',
                // Character.AI
                'character.ai', 'beta.character.ai',
                // Meta AI
                'meta.ai',
                // Phind
                'phind.com',
                // Kimi AI
                'kimi.moonshot.cn', 'kimi.ai', 'kimi.com',
                // Your own site
                'helloworldgpt.com', 'helloprompt.ing',
                // Local dev
                'localhost'
            ];
            return aiSites.some(site => hostname === site || hostname.endsWith('.' + site));
        }

        detectContext() {
            const hostname = window.location.hostname;
            const text = document.body.innerText.slice(0, 5000);
            
            if (hostname.includes('chatgpt.com') || hostname.includes('openai.com')) this.state.platform = 'chat';
            else if (hostname.includes('gemini.google.com') || hostname.includes('aistudio.google.com')) this.state.platform = 'chat';
            else if (hostname.includes('amazon.com') || hostname.includes('product')) this.state.platform = 'product';
            else if (text.length > 3000) this.state.platform = 'article';
            else if (hostname.includes('news') || hostname.includes('times')) this.state.platform = 'news';
            else this.state.platform = 'generic';

            this.config.isDarkMode = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
            document.documentElement.setAttribute('hwgpt-platform', this.state.platform);
            
            // Send context to extension to update sidepanel "Intelligence"
            this.callExtension('update-context', { 
                platform: this.state.platform, 
                hostname: hostname,
                title: document.title
            });
        }

        programmaticBoost() {
            if (!document.head) {
                setTimeout(() => this.programmaticBoost(), 100);
                return;
            }
            if (document.querySelector('meta[name="hello-prompt-optimized"]')) return;
            const meta = document.createElement('meta');
            meta.name = 'hello-prompt-optimized';
            meta.content = 'true';
            document.head.appendChild(meta);
        }

        createShadowDOM() {
            const hostId = 'hwgpt-pro-root';
            let host = document.getElementById(hostId);
            if (host) host.remove();

            host = document.createElement('div');
            host.id = hostId;
            host.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;overflow:visible;z-index:2147483647;pointer-events:none;display:block !important;';

            try {
                (document.body || document.documentElement).appendChild(host);
            } catch (e) {
                document.documentElement.appendChild(host);
            }

            this.shadowRoot = host.attachShadow({ mode: 'open' });
            host.setAttribute('platform', this.state.platform);
            const style = document.createElement('style');

            // Add SVG Definitions
            const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svgDefs.style.display = 'none';
            svgDefs.innerHTML = `
                <defs>
                    <linearGradient id="hpRingGrad_html" x1="0%" y1="0%" x2="100%" y2="100%">
                        <stop offset="0%" style="stop-color:#2196F3" />
                        <stop offset="12%" style="stop-color:#00BCD4" />
                        <stop offset="25%" style="stop-color:#4CAF50" />
                        <stop offset="37%" style="stop-color:#8BC34A" />
                        <stop offset="50%" style="stop-color:#FFEB3B" />
                        <stop offset="62%" style="stop-color:#FF9800" />
                        <stop offset="75%" style="stop-color:#F44336" />
                        <stop offset="87%" style="stop-color:#E91E90" />
                        <stop offset="100%" style="stop-color:#9C27B0" />
                    </linearGradient>
                    <filter id="logoGlow_html" x="-20%" y="-20%" width="140%" height="140%">
                        <feGaussianBlur stdDeviation="2" result="blur" />
                        <feComposite in="SourceGraphic" in2="blur" operator="over" />
                    </filter>
                </defs>
            `;
            this.shadowRoot.appendChild(svgDefs);

            this.container = document.createElement('div');
            this.container.id = 'hwgpt-main-wrapper';
            this.container.style.cssText = 'position:fixed;top:0;left:0;width:100vw;height:100vh;pointer-events:none;z-index:2147483647;';
            this.shadowRoot.appendChild(this.container);

            style.textContent = `
                :host {
                    --hwgpt-bg-rgba: 255, 255, 255;
                    --hwgpt-primary: #3B82F6;
                    --hwgpt-accent: #10B981;
                    --hwgpt-text: #1a1a1a;
                    --hwgpt-text-secondary: #555555;
                    --hwgpt-radius: 39px;
                    --hwgpt-shadow: 0 12px 40px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.04);
                    --google-spring: cubic-bezier(0.2, 0, 0, 1);
                    --hp-gradient: linear-gradient(135deg, #3B82F6, #10B981, #EAB308, #EF4444, #A855F7);
                    --hwgpt-glow: none;
                    --hwgpt-border: rgba(0, 0, 0, 0.08);
                    --sexy-gradient: linear-gradient(135deg, #000, #333);
                    font-family: "Gordita", -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
                }

                @keyframes gradient-shift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }

                .hwgpt-copilot-container {
                    position: relative;
                    padding: 18px 22px;
                    border-radius: 28px;
                    background: #ffffff;
                    box-shadow: 0 12px 48px rgba(0, 0, 0, 0.12), 0 4px 12px rgba(0,0,0,0.04);
                    transition: all 0.4s var(--google-spring);
                    width: 340px;
                    display: flex;
                    flex-direction: column;
                    border: 1px solid rgba(0,0,0,0.05);
                }

                /* Speech Bubble Tail */
                .hwgpt-copilot-container::after {
                    content: "";
                    position: absolute;
                    bottom: -10px;
                    right: 45px;
                    width: 20px;
                    height: 20px;
                    background: #ffffff;
                    transform: rotate(45deg);
                    border-right: 1px solid rgba(0,0,0,0.05);
                    border-bottom: 1px solid rgba(0,0,0,0.05);
                    z-index: -1;
                }

                .hwgpt-copilot-inner {
                    background: transparent;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                }

                /* inner is now defined above with container */

                /* Force light mode for the extension popup */
                :host {
                    color-scheme: light;
                }

                .hwgpt-fab-container {
                    position: fixed;
                    bottom: 40px;
                    right: 40px;
                    z-index: 2147483647;
                    display: flex;
                    flex-direction: column;
                    align-items: flex-end;
                    justify-content: center;
                    opacity: 1 !important;
                    pointer-events: auto !important;
                    transition: all 0.3s var(--google-spring);
                    transform: scale(1) translateY(0);
                }

                .hwgpt-fab-container.typing {
                    transform: scale(0.95) translateY(5px);
                    opacity: 0.8 !important;
                }
                .hwgpt-fab {
                    width: auto;
                    height: 48px;
                    background: #ffffff;
                    border-radius: 100px;
                    display: flex;
                    align-items: center;
                    cursor: pointer;
                    padding: 0 16px;
                    position: relative;
                    z-index: 2147483647;
                    box-shadow: 0 10px 40px rgba(0,0,0,0.08);
                    transition: all 0.4s var(--google-spring);
                    border: 1px solid rgba(0,0,0,0.04);
                    animation: alive-float 6s infinite ease-in-out;
                    gap: 12px;
                }

                .hwgpt-fab-status-dot {
                    width: 14px;
                    height: 14px;
                    background: #10B981;
                    border-radius: 50%;
                    box-shadow: 0 0 12px rgba(16,185,129,0.3);
                    flex-shrink: 0;
                }

                .hwgpt-fab-logo-circle {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    padding: 2.5px;
                    background: conic-gradient(from 180deg, #00F0FF, #4285F4, #9C27B0, #E91E63, #4285F4, #00F0FF);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                    animation: neural-rotate 6s linear infinite;
                }

                .hwgpt-fab-logo-inner {
                    width: 100%;
                    height: 100%;
                    background: white;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    overflow: hidden;
                }

                .hwgpt-fab-logo-inner img {
                    width: 12px;
                    height: 12px;
                    object-fit: contain;
                }

                .hwgpt-fab-text {
                    font-size: 14px;
                    font-weight: 500;
                    color: #6B7280;
                    letter-spacing: -0.01em;
                    pointer-events: none;
                }

                @keyframes neural-rotate {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
                
                @keyframes alive-float {
                    0%, 100% { transform: translateY(0); }
                    50% { transform: translateY(-3px); }
                }

                .hwgpt-fab:hover {
                    transform: scale(1.05) translateY(-4px);
                    box-shadow: 0 20px 40px rgba(0,0,0,0.15);
                    border-color: rgba(66, 133, 244, 0.2);
                }

                .hwgpt-fab:active {
                    transform: scale(0.95);
                    transition: transform 0.1s;
                }

                .hwgpt-fab .hp-badge {
                    position: absolute;
                    top: -6px;
                    right: -6px;
                    min-width: 18px;
                    height: 18px;
                    padding: 0 2px;
                    background: #FF4D4D;
                    border: 2px solid white;
                    border-radius: 50%;
                    color: white;
                    font-size: 10px;
                    font-weight: 900;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 4px 10px rgba(255, 77, 77, 0.4);
                    transition: all 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .hwgpt-fab:hover .hp-badge {
                    transform: scale(1.15);
                }

                .hwgpt-fab:hover .hp-badge {
                    transform: scale(1.15);
                }

                .hwgpt-tip-item {
                    padding: 12px 14px;
                    border-radius: 14px;
                    background: transparent;
                    border: 1px solid transparent;
                    transition: all 0.2s var(--google-spring);
                    cursor: pointer;
                    display: flex;
                    align-items: flex-start;
                    gap: 12px;
                }

                .hwgpt-tip-item:hover {
                    background: rgba(255, 255, 255, 0.3);
                    border-color: rgba(255, 255, 255, 0.5);
                    transform: translateY(-1px);
                    box-shadow: 0 4px 12px rgba(0,0,0,0.03);
                }

                /* fab hover is now defined above */

                /* Premium FAB Look */
                .hwgpt-fab .hp-logo-svg {
                    width: 26px !important;
                    height: 26px !important;
                    transition: all 0.3s var(--google-spring);
                }

                .hwgpt-copilot-container {
                    cursor: grab;
                }

                .hwgpt-copilot-container:active {
                    cursor: grabbing;
                }

                .hwgpt-header {
                    cursor: grab;
                }

                .hwgpt-header:active {
                    cursor: grabbing;
                }

                .hwgpt-loader {
                    display: none;
                }

                .hwgpt-fab.enhancing .hwgpt-loader { display: none; }

                /* Rotating gradient border animation on the FAB */
                .hwgpt-fab.enhancing {
                    border: 2px solid transparent;
                    background-image: linear-gradient(white, white), conic-gradient(#3B82F6, #10B981, #FBBF24, #EF4444, #3B82F6);
                    background-origin: border-box;
                    background-clip: padding-box, border-box;
                    animation: hwgpt-border-rotate 1.2s linear infinite;
                }

                @keyframes hwgpt-border-rotate {
                    0% { filter: hue-rotate(0deg); }
                    100% { filter: hue-rotate(360deg); }
                }

                @keyframes hwgpt-spin { to { transform: rotate(360deg); } }

                .hwgpt-suggestions {
                    position: fixed;
                    bottom: 105px;
                    right: 42px;
                    z-index: 2147483647;
                    display: none;
                }

                .hwgpt-suggestions.visible { display: block !important; }

                .hwgpt-header {
                    height: 52px;
                    min-height: 52px;
                    padding: 12px 30px 0;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    border-bottom: 1px solid #f0f0f0;
                }

                .hwgpt-brand {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    font-weight: 500;
                    font-size: 14px;
                    color: #737373;
                    letter-spacing: -0.01em;
                }

                .hwgpt-content {
                    padding: 20px 30px;
                    display: flex;
                    flex-direction: column;
                    gap: 12px;
                    overflow-y: auto;
                    flex: 1;
                }

                .hwgpt-content::-webkit-scrollbar {
                    width: 4px;
                }
                .hwgpt-content::-webkit-scrollbar-track {
                    background: transparent;
                }
                .hwgpt-content::-webkit-scrollbar-thumb {
                    background: #737373;
                    border-radius: 10px;
                }

                .hwgpt-tip-section {
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                .hwgpt-tip-item {
                    display: flex;
                    align-items: flex-start;
                    gap: 0;
                    padding: 4px 0;
                    border-radius: 0;
                    background: transparent;
                    border: none;
                    transition: all 0.2s ease;
                }
                
                .hwgpt-tip-item:hover {
                    transform: translateX(2px);
                    background: transparent;
                    box-shadow: none;
                }

                .hwgpt-tip-text {
                    font-size: 15px;
                    color: #334155;
                    font-weight: 400;
                    line-height: 1.5;
                }

                .hwgpt-score-badge-inline {
                    display: inline-flex;
                    align-items: center;
                    padding: 2px 10px;
                    border-radius: 20px;
                    font-size: 11px;
                    font-weight: 700;
                    color: white;
                    margin-left: 10px;
                    vertical-align: middle;
                    font-family: "Gordita", sans-serif;
                }

                .hwgpt-control-btn svg {
                    color: #737373 !important;
                    stroke: #737373 !important;
                }

                .hwgpt-tip-item.selected {
                    border-color: transparent;
                    background-image: linear-gradient(#fff, #fff), linear-gradient(135deg, #93C5FD, #6EE7B7, #FDE68A, #FCA5A5);
                    background-origin: border-box;
                    background-clip: padding-box, border-box;
                    box-shadow: 0 0 12px rgba(147, 197, 253, 0.3), 0 0 12px rgba(110, 231, 183, 0.2), 0 0 12px rgba(252, 165, 165, 0.2);
                }

                .hwgpt-theme-bullet {
                    width: 8px;
                    height: 8px;
                    border-radius: 50%;
                    background: #10B981;
                    flex-shrink: 0;
                    margin-top: 7px;
                    position: relative;
                }

                .hwgpt-tip-text {
                    font-size: 13px;
                    font-weight: 400;
                    color: #333;
                    line-height: 1.55;
                }

                .hwgpt-tip-item:hover .hwgpt-tip-text {
                    color: var(--hwgpt-text);
                }

                .hwgpt-suggestion-btn {
                    width: 100%;
                    padding: 14px 18px;
                    border-radius: 14px;
                    background: var(--hwgpt-bg);
                    border: 1px solid var(--hwgpt-border);
                    color: var(--hwgpt-text);
                    font-size: 14px;
                    font-weight: 600;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                }

                .hwgpt-suggestion-btn:hover {
                    border-color: #00F0FF;
                    background: rgba(0, 240, 255, 0.05);
                }

                .hwgpt-footer {
                    padding: 10px 16px;
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    background: transparent;
                }

                .hwgpt-accept-btn {
                    padding: 10px 28px;
                    background: #ffffff;
                    color: #a6a6a6;
                    border: 2px solid rgba(0, 0, 0, 0.08);
                    border-radius: 100px;
                    font-size: 15px;
                    font-weight: 700;
                    cursor: pointer;
                    transition: all 0.2s ease;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.06);
                }

                .hwgpt-accept-btn:hover {
                    transform: scale(1.03);
                    border-color: rgba(0, 0, 0, 0.15);
                    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
                }

                .hwgpt-controls {
                    position: absolute;
                    top: 10px;
                    right: 12px;
                    display: flex;
                    gap: 6px;
                    z-index: 10;
                }

                .hwgpt-control-btn {
                    width: 24px;
                    height: 24px;
                    border-radius: 50%;
                    border: none;
                    background: transparent;
                    color: var(--hwgpt-text-secondary);
                    cursor: pointer;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 12px;
                    opacity: 0.4;
                    transition: all 0.2s;
                }

                .hwgpt-control-btn:hover {
                    background: rgba(0,0,0,0.05);
                    opacity: 1;
                }

                .hwgpt-toast {
                    position: fixed;
                    bottom: 40px;
                    left: 50%;
                    transform: translateX(-50%) translateY(100px);
                    background: #111;
                    color: #fff;
                    padding: 16px 32px;
                    border-radius: 100px;
                    font-size: 15px;
                    font-weight: 600;
                    box-shadow: 0 20px 60px rgba(0,0,0,0.4);
                    z-index: 2147483647;
                    transition: all 0.4s var(--google-spring);
                    display: flex;
                    align-items: center;
                    gap: 16px;
                    border: 1px solid rgba(255,255,255,0.1);
                }

                .hwgpt-toast.visible { transform: translateX(-50%) translateY(0); }
            `;
            this.shadowRoot.appendChild(style);

            this.suggestionsBox = document.createElement('div');
            this.suggestionsBox.id = 'hwgpt-suggestions';
            this.suggestionsBox.className = 'hwgpt-suggestions';
            this.container.appendChild(this.suggestionsBox);

            this.fabContainer = document.createElement('div');
            this.fabContainer.className = 'hwgpt-fab-container';
            this.fabContainer.innerHTML = `
                <button class="hwgpt-fab" id="hwgpt-fab">
                    <div class="hwgpt-fab-status-dot"></div>
                    <div class="hwgpt-fab-logo-circle">
                        <div class="hwgpt-fab-logo-inner">
                            <img src="${chrome.runtime.getURL('icons/Hello Icon.png')}" alt="H" loading="lazy" decoding="async">
                        </div>
                    </div>
                    <div class="hwgpt-fab-text">Browser Layer</div>
                    <div class="hwgpt-fab-score" style="position: absolute; top: -10px; right: 0; font-size: 10px; font-weight: 900; background: #10B981; color: white; padding: 2px 6px; border-radius: 10px; display: none; box-shadow: 0 4px 10px rgba(16,185,129,0.3); border: 2px solid white;">0%</div>
                </button>
            `;
            this.container.appendChild(this.fabContainer);
            this.fab = this.shadowRoot.querySelector('#hwgpt-fab');

            // PHASE 1: CLS RESERVE — Pre-allocate suggestion space
            this.suggestionsBox.style.minHeight = '0px';
            this.suggestionsBox.style.contain = 'layout style';
            this.suggestionsBox.style.contentVisibility = 'auto';

            console.log('[PHASE1] Shadow DOM v6.0 with INP Hardening + CLS Reserve initialized.');
        }

        startObservation() {
            // Initial targeted scan
            this.scan(document);

            let scanTimeout = null;
            this.observer = new MutationObserver((mutations) => {
                // Performance: Batch DOM changes and throttle scanning (CWS Quality Guideline)
                // This prevents UI freezes during massive DOM updates (e.g., streaming chats)
                const hasNewElements = mutations.some(m =>
                    Array.from(m.addedNodes).some(node => node.nodeType === 1)
                );

                if (hasNewElements) {
                    clearTimeout(scanTimeout);
                    scanTimeout = setTimeout(() => this.scan(document), 400);
                }
            });
            this.observer.observe(document.body, { childList: true, subtree: true });

            this.selectionHandler = () => {
                const el = document.activeElement;
                if (this.observedElements.has(el)) this.handleInput(el);
            };
            document.addEventListener('selectionchange', this.selectionHandler);
        }

        scan(root = document) {
            if (!this.isAIChatbotSite()) return;

            const selectors = [
                '#prompt-textarea', 'textarea', 'div[contenteditable="true"]',
                '[role="textbox"]', '.ProseMirror', '.cm-content'
            ];

            const scanNode = (root) => {
                // Targeted Crawler: Uses TreeWalker for branch-specific discovery
                const walker = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT, {
                    acceptNode: (node) => {
                        // Skip our own UI and large static text blocks
                        if (node.id === 'hwgpt-pro-root' || node.tagName === 'SCRIPT' || node.tagName === 'STYLE') {
                            return NodeFilter.FILTER_REJECT;
                        }
                        return NodeFilter.FILTER_ACCEPT;
                    }
                });

                let currentNode = walker.currentNode;
                while (currentNode) {
                    // Check if node matches target inputs
                    const isTarget = selectors.some(s => {
                        try { return currentNode.matches && currentNode.matches(s); } catch (e) { return false; }
                    });

                    if (isTarget && !this.observedElements.has(currentNode)) {
                        const el = currentNode;
                        this.observedElements.add(el);
                        el.addEventListener('focus', () => this.handleFocus(el));
                        el.addEventListener('input', () => this.handleInput(el));
                        el.addEventListener('keyup', () => this.handleInput(el));
                        el.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter') this.debounceAnalysis(true);
                            else this.handleInput(el);
                        });

                        if (document.activeElement === el) this.handleFocus(el);
                    }

                    // Recursively scan Shadow DOMs if present
                    if (currentNode.shadowRoot) {
                        scanNode(currentNode.shadowRoot);
                    }

                    currentNode = walker.nextNode();
                }
            };
            scanNode(root);
        }

        handleFocus(el) {
            // Don't activate on non-AI sites
            if (!this.isAIChatbotSite()) return;
            this.state.activeElement = el;
            this.updatePosition();
            this.checkVisibility(true);
            this.debounceAnalysis();
        }

        handleInput(el) {
            this.state.activeElement = el;
            this.checkVisibility();

            if (this.state.ignoreNextInput) {
                this.state.ignoreNextInput = false;
                return;
            }

            // User is physically typing → exit post-enhance mode
            this.state.postEnhanceMode = false;
            this.state.lastEnhancedText = '';
            this.state.lastEnhancedScore = 0;

            this.fabContainer.classList.add('typing');
            this.debounceAnalysis();

            clearTimeout(this.typingTimeout);
            this.typingTimeout = setTimeout(() => {
                this.fabContainer.classList.remove('typing');
            }, 500);
        }

        debounceAnalysis(instant = false) {
            // Level 1: Instant Local Score (Privacy-Safe Heuristics)
            this.analyzeLocalAndCache();

            // Level 2: Debounced LLM Analysis
            // Safety: Only trigger LLM for meaningful input (>15 chars) to avoid exfiltration flags
            const text = (this.state.activeElement?.value || this.state.activeElement?.innerText || '').trim();
            if (text.length < 15 && !instant) return;

            // 450ms for live typing: Professional "Sweet Spot" (Meta AI style)
            // 50ms for explicit triggers (Enter/Button) to maintain UI responsiveness
            clearTimeout(this.llmTimeout);
            this.llmTimeout = setTimeout(() => this.analyzeLLM(), instant ? 50 : 450);
        }
        extractDOMFeatures(text) {
            return {
                length: text.length,
                wordCount: text.split(/\s+/).filter(Boolean).length,
                lineCount: text.split('\n').length,
                hasPunctuation: /[.?!,;:]/.test(text),
                hasQuestionMark: text.includes('?'),
                hasNewlines: text.includes('\n'),
                isAllCaps: text === text.toUpperCase() && text.length > 5,
                hasCodeBlock: /```|`[^`]+`/.test(text),
                hasNumbers: /\d/.test(text),
                hasUrls: /https?:\/\/\S+/.test(text)
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // LAYER 1: SUPERIOR INTENT ENGINE (0-5ms)
        // ═══════════════════════════════════════════════════════════════
        classifyIntent(text) {
            const lower = text.toLowerCase();
            const patterns = {
                'writing-draft': /\b(write|create|draft|compose|blog|essay|article|story|post|content)\b/i,
                'reply-intent': /\b(reply|respond|answer|say to|tell|email back|comment on)\b/i,
                'code-logic': /\b(code|function|bug|fix|error|javascript|python|react|debug|api)\b/i,
                'research-compare': /\b(compare|analysis|difference|vs|better than|pros and cons|summarize)\b/i,
                'question-intent': /\b(how|why|what|when|where|who|is it|can i|should i)\b/i,
            };
            
            // Contextual clues from the DOM (e.g., is it a comment box or a new post?)
            const el = this.state.activeElement;
            const contextClue = (el?.placeholder || el?.title || el?.ariaLabel || '').toLowerCase();
            
            if (contextClue.includes('comment') || contextClue.includes('reply')) return 'reply-intent';
            if (contextClue.includes('post') || contextClue.includes('title')) return 'writing-draft';
            
            for (const [intent, regex] of Object.entries(patterns)) {
                if (regex.test(lower)) return intent;
            }
            return 'general';
        }

        getLocalScore(text) {
            const trimmed = text.trim();
            const words = trimmed.split(/\s+/).filter(Boolean);
            const wordCount = words.length;

            // Strict Validation: Minimal or non-meaningful input gets 0%
            if (trimmed.length < 5 || wordCount < 3) {
                return {
                    score: 0,
                    intent: 'general',
                    features: this.extractDOMFeatures(text)
                };
            }

            const features = this.extractDOMFeatures(text);
            const intent = this.classifyIntent(text);
            let score = 25;

            // Length scoring (linear up to 100%)
            score += Math.min(40, text.length / 5);

            // Structure scoring
            if (features.hasPunctuation) score += 10;
            if (features.hasQuestionMark) score += 5;

            // Intent bonus (aligned with v5.0.2 Scientific Framework)
            const intentBonus = {
                'code-review': 20, // High (Technical focus)
                'analyze': 18,      // High (Analytical focus)
                'explain': 14,      // Moderate (Reasoning focus)
                'summarize': 12,    // Moderate (Structure focus)
                'generate': 10,     // Moderate (Production focus)
                'brainstorm': 6,    // Low (Exploratory focus)
                'translate': 5,     // Low
                'general': 0
            };
            score += intentBonus[intent] || 0;

            // Technical depth indicators
            if (features.hasCodeBlock) score += 12;
            if (features.hasNumbers) score += 4;
            if (features.hasUrls) score += 6;

            // Penalties (Very light to avoid "jumping" scores)
            if (text.length < 5) score -= 5;
            if (features.isAllCaps) score -= 15;

            return {
                score: Math.min(95, Math.max(10, Math.round(score))),
                intent,
                features
            };
        }

        // ═══════════════════════════════════════════════════════════════
        // LAYER 2: LRU Pattern Cache (10-50ms)
        // ═══════════════════════════════════════════════════════════════
        getPatternCacheKey(text, context) {
            // Use full text hash for precise matching
            return this.hashString(text + '|' + context);
        }

        getCachedPattern(text, context) {
            if (!this.patternCache) this.patternCache = new Map();
            const key = this.getPatternCacheKey(text, context);
            return this.patternCache.get(key) || null;
        }

        setCachedPattern(text, context, analysis) {
            if (!this.patternCache) this.patternCache = new Map();
            const key = this.getPatternCacheKey(text, context);
            // LRU: Keep max 50 entries
            if (this.patternCache.size >= 100) {
                const firstKey = this.patternCache.keys().next().value;
                this.patternCache.delete(firstKey);
            }
            this.patternCache.set(key, { ...analysis, timestamp: Date.now() });
        }



        async analyzeLocalAndCache() {
            if (!this.state.activeElement || isOrphaned()) return;
            const text = (this.state.activeElement.value || this.state.activeElement.innerText || '');

            if (text.length < 1) {
                this.suggestionsBox.classList.remove('visible');
                return;
            }

            // L0 + L1: Instant local analysis
            const localAnalysis = this.getLocalScore(text);
            const hostname = window.location.hostname;

            // Check cache (60s TTL for fresh suggestions)
            const cached = this.getCachedPattern(text, hostname);
            if (cached && (Date.now() - cached.timestamp) < 60000 && !cached.isLocal) {
                // Override cached score if in post-enhance mode
                if (this.state.postEnhanceMode && this.state.lastEnhancedScore > 0) {
                    cached.score = Math.max(cached.score || 0, this.state.lastEnhancedScore);
                }
                this.showSuggestions(cached);
                return;
            }

            this.state.lastRawText = text;

            // Use the saved high score if we're in post-enhance mode
            const finalScore = this.state.postEnhanceMode && this.state.lastEnhancedScore > 0
                ? Math.max(localAnalysis.score, this.state.lastEnhancedScore)
                : localAnalysis.score;

            // Clear selected suggestion when not in post-enhance mode
            if (!this.state.postEnhanceMode) {
                this.state.selectedSuggestion = null;
            }

            // Generate multiple context-aware local tips instantly
            const localTips = this.generateLocalTips(text, localAnalysis.intent, localAnalysis.features);
            this.showSuggestions({
                score: finalScore,
                tip: localTips[0],
                suggestions: localTips.slice(1),
                isLocal: true,
                intent: localAnalysis.intent
            });
        }

        async analyzeLLM() {
            if (!this.state.activeElement || isOrphaned()) return;
            const text = (this.state.activeElement.value || this.state.activeElement.innerText || '');
            if (text.length < 1) return;

            // Skip if text hasn't changed since last LLM analysis
            if (text === this.state.lastAnalyzedText && this.state.lastAnalysis) {
                this.showSuggestions(this.state.lastAnalysis);
                return;
            }

            const now = Date.now();
            if (!this.state.cachedChatContext || (now - (this.state.lastContextScrape || 0) > 10000)) {
                this.state.cachedChatContext = this.getChatContext();
                this.state.lastContextScrape = now;
                this.state.cachedContextHash = this.hashString(this.state.cachedChatContext);
            }

            console.log('📡 HWGPT: Triggering LLM analysis for text:', text.substring(0, 20) + '...');
            const response = await this.callExtension('live-analyze', {
                text: text.substring(0, 2000),
                context: window.location.hostname,
                chatContext: this.state.cachedChatContext,
                contextHash: this.state.cachedContextHash,
                uiLanguage: chrome.i18n.getUILanguage()
            });

            console.log('📡 HWGPT: LLM Analysis response received:', response);

            if (response && response.analysis) {
                // Real LLM score arrived — exit post-enhance mode, use real score
                this.state.postEnhanceMode = false;

                this.state.lastAnalyzedText = text;
                this.state.lastAnalysis = response.analysis;
                this.setCachedPattern(text, window.location.hostname, response.analysis);
                this.showSuggestions(response.analysis);
            }
        }

        // ═══════════════════════════════════════════════════════════════
        // SMART LLM GATE: Decides if L3 (Gemini) call is necessary
        // ═══════════════════════════════════════════════════════════════
        shouldCallLLM(localAnalysis, text, delta) {
            const cleanText = text.trim();
            const words = cleanText.split(/\s+/).filter(Boolean).length;
            // Trigger on 15+ chars (space-independent) OR 3+ words
            return cleanText.length >= 15 || words >= 3;
        }

        // ═══════════════════════════════════════════════════════════════
        // DYNAMIC LOCAL TIP GENERATOR (Inspired by Google Gemini Prompting Strategies)
        // Analyzes the actual text to detect what's missing and provides
        // context-specific, actionable suggestions that change as user types.
        // ═══════════════════════════════════════════════════════════════
        generateLocalTips(text, intent, features) {
            const lower = text.toLowerCase().trim();
            const words = lower.split(/\s+/).filter(Boolean);
            const tips = [];

            // ── 1. DETECT TOPIC KEYWORDS for context-specific suggestions ──
            const topicDetectors = [
                { keywords: ['diet', 'food', 'eat', 'nutrition', 'meal', 'recipe', 'cook', 'calorie'], topic: 'food' },
                { keywords: ['university', 'college', 'school', 'education', 'study', 'course', 'degree', 'admission'], topic: 'education' },
                { keywords: ['travel', 'trip', 'visit', 'tour', 'hotel', 'flight', 'destination', 'vacation'], topic: 'travel' },
                { keywords: ['code', 'program', 'function', 'bug', 'error', 'api', 'database', 'deploy', 'software'], topic: 'coding' },
                { keywords: ['market', 'business', 'startup', 'revenue', 'customer', 'brand', 'strategy', 'growth'], topic: 'business' },
                { keywords: ['health', 'doctor', 'medicine', 'symptom', 'treatment', 'exercise', 'workout', 'fitness'], topic: 'health' },
                { keywords: ['design', 'ui', 'ux', 'color', 'layout', 'logo', 'brand', 'figma', 'css'], topic: 'design' },
                { keywords: ['write', 'essay', 'blog', 'article', 'story', 'content', 'copy', 'post'], topic: 'writing' },
                { keywords: ['math', 'equation', 'calculate', 'formula', 'statistics', 'probability'], topic: 'math' },
                { keywords: ['invest', 'stock', 'finance', 'money', 'budget', 'saving', 'crypto', 'trading'], topic: 'finance' },
                { keywords: ['image', 'photo', 'video', 'edit', 'generate', 'draw', 'illustration'], topic: 'media' },
                { keywords: ['email', 'letter', 'message', 'reply', 'respond', 'draft'], topic: 'communication' }
            ];

            let detectedTopic = 'general';
            for (const { keywords, topic } of topicDetectors) {
                if (keywords.some(k => lower.includes(k))) {
                    detectedTopic = topic;
                    break;
                }
            }

            // ── 2. TOPIC-SPECIFIC CONTEXTUAL TIPS ──
            const topicTips = {
                'food': [
                    'Specify dietary preferences (vegetarian, keto, halal, gluten-free, etc.).',
                    'Mention your budget range or calorie target per meal.',
                    'Clarify if you want local dishes, homemade, or restaurant options.',
                    'Add health goals like weight loss, muscle gain, or balanced nutrition.',
                    'Specify meal type: breakfast, lunch, dinner, or snacks.'
                ],
                'education': [
                    'Specify your field of study or academic interest.',
                    'Mention budget, location preference, or scholarship requirements.',
                    'Clarify undergraduate, graduate, or PhD level.',
                    'Add criteria like ranking, campus life, or research opportunities.',
                    'Specify if you want public, private, or online institutions.'
                ],
                'travel': [
                    'Mention your travel dates, budget, and group size.',
                    'Specify what type of experience: adventure, relaxation, culture, etc.',
                    'Add dietary or accessibility requirements.',
                    'Clarify if you need visa, hotel, or itinerary suggestions.',
                    'Mention any must-see attractions or activities.'
                ],
                'coding': [
                    'Specify the programming language and version.',
                    'Include error messages or the expected vs actual behavior.',
                    'Mention the framework, library, or environment you\'re using.',
                    'Add constraints like performance, security, or compatibility needs.',
                    'Describe the broader project context for better solutions.'
                ],
                'business': [
                    'Define your target market, audience size, or demographics.',
                    'Specify your budget, timeline, or stage (idea, MVP, scaling).',
                    'Mention competitors or industry context for better strategy.',
                    'Clarify what success metrics matter: revenue, users, engagement.',
                    'Add geographic or regulatory constraints.'
                ],
                'health': [
                    'Mention your age, fitness level, or health conditions.',
                    'Specify your goal: weight loss, strength, flexibility, recovery.',
                    'Clarify if you want exercises, diet plans, or medical info.',
                    'Add time constraints (e.g., 15-min workouts, weekly plans).',
                    'Mention equipment availability: gym, home, outdoors.'
                ],
                'design': [
                    'Specify the platform: web, mobile, print, or social media.',
                    'Mention your brand colors, style preferences, or target audience.',
                    'Clarify deliverables: mockup, wireframe, or production-ready.',
                    'Add dimensions, resolution, or format requirements.',
                    'Reference examples of styles you like.'
                ],
                'writing': [
                    'Specify the tone: formal, casual, persuasive, or academic.',
                    'Mention word count, format (blog, essay, email), and audience.',
                    'Add the key message or thesis you want to convey.',
                    'Clarify if you need SEO optimization or keywords inclusion.',
                    'Provide context about the publication platform.'
                ],
                'math': [
                    'Show your work so far or the specific step where you\'re stuck.',
                    'Specify if you need step-by-step solution or just the answer.',
                    'Mention the level: high school, undergraduate, or graduate.',
                    'Clarify which formula or theorem to apply.',
                    'Add any constraints or given conditions.'
                ],
                'finance': [
                    'Specify your risk tolerance: conservative, moderate, or aggressive.',
                    'Mention your investment timeline and current portfolio size.',
                    'Clarify your financial goal: retirement, savings, passive income.',
                    'Add geographic context for tax or regulation relevance.',
                    'Specify if you want analysis, comparison, or recommendations.'
                ],
                'media': [
                    'Specify resolution, aspect ratio, or file format needed.',
                    'Describe the style: realistic, cartoon, minimalist, etc.',
                    'Mention the purpose: social media, presentation, print.',
                    'Add color palette or mood preferences.',
                    'Clarify if you need editing tips or generation prompts.'
                ],
                'communication': [
                    'Specify the tone: professional, friendly, urgent, or apologetic.',
                    'Mention the recipient and your relationship context.',
                    'Clarify the key action you want the recipient to take.',
                    'Add length preference: brief, detailed, or bullet points.',
                    'Mention any deadlines or time-sensitive context.'
                ]
            };

            // ── 3. STRUCTURAL ANALYSIS - What's missing from the prompt? ──
            // (Inspired by Google Gemini's prompting strategies: constraints, format, examples, context)

            // Check for missing specificity
            if (words.length < 8 && words.length > 0) {
                tips.push(chrome.i18n.getMessage("tipBrief") || `Your prompt is brief (${words.length} words). Add more detail about what specifically you need.`);
            }

            // Check for missing format specification
            const hasFormatRequest = /\b(list|table|paragraph|bullet|step.?by.?step|json|csv|summary|outline|markdown)\b/i.test(text);
            if (!hasFormatRequest && words.length >= 3) {
                tips.push(chrome.i18n.getMessage("tipFormat") || 'Specify your desired output format (list, table, step-by-step, etc.).');
            }

            // Check for missing audience/who
            const hasAudience = /\b(beginner|expert|student|professional|child|developer|manager|team|client|customer)\b/i.test(text);
            if (!hasAudience && words.length >= 4) {
                tips.push(chrome.i18n.getMessage("tipAudience") || 'Define your target audience or expertise level for a tailored response.');
            }

            // Check for missing constraints
            const hasConstraints = /\b(must|should|only|at least|at most|maximum|minimum|within|limit|no more|don\'t|avoid|exclude|between \d)\b/i.test(text);
            if (!hasConstraints && words.length >= 5) {
                tips.push(chrome.i18n.getMessage("tipConstraints") || 'Add constraints (e.g., word count, budget, timeframe) to focus the response.');
            }

            // Check for missing context
            const hasContext = /\b(because|since|given that|as a|for my|in the context|background|currently|situation)\b/i.test(text);
            if (!hasContext && words.length >= 3) {
                tips.push(chrome.i18n.getMessage("tipContext") || 'Add context about your situation for more relevant suggestions.');
            }

            // Check for missing examples (few-shot strategy from Gemini docs)
            const hasExamples = /\b(example|such as|like|e\.g|for instance|similar to|inspired by)\b/i.test(text);
            if (!hasExamples && words.length >= 6) {
                tips.push(chrome.i18n.getMessage("tipExamples") || 'Include examples of what you\'re looking for to guide the AI response.');
            }

            // Check for missing role/persona assignment
            const hasRole = /\b(act as|you are|pretend|imagine you|as a|role of|expert in|specialist)\b/i.test(text);
            if (!hasRole && intent !== 'general' && words.length >= 5) {
                tips.push(chrome.i18n.getMessage("tipRole") || 'Assign an expert role (e.g., "Act as a nutritionist...") for deeper answers.');
            }

            // Add topic-specific tips (pick ones not yet covered)
            const topicSpecificTips = topicTips[detectedTopic] || [];
            for (const topicTip of topicSpecificTips) {
                // Avoid duplicating structural tips already added
                const isDuplicate = tips.some(t => {
                    const tWords = t.toLowerCase().split(/\s+/);
                    const ttWords = topicTip.toLowerCase().split(/\s+/);
                    const overlap = tWords.filter(w => ttWords.includes(w) && w.length > 4).length;
                    return overlap >= 3;
                });
                if (!isDuplicate && tips.length < 5) {
                    tips.push(topicTip);
                }
            }

            // Intent-specific fallbacks if we still need more tips
            const intentFallbacks = {
                'code-review': 'Paste the relevant code snippet or error output for targeted help.',
                'summarize': 'Specify the desired length and key aspects to highlight.',
                'explain': 'Mention your current knowledge level for the right depth.',
                'generate': 'Provide a sample of the style or tone you want.',
                'translate': 'Specify source and target languages plus formality level.',
                'analyze': 'Define success criteria or the framework for evaluation.',
                'brainstorm': 'Set a target number of ideas and any category constraints.',
                'general': 'Break your request into specific sub-questions for better results.'
            };
            if (tips.length < 3 && intentFallbacks[intent]) {
                tips.push(intentFallbacks[intent]);
            }

            // Ensure we always have at least 2 tips
            if (tips.length < 2) {
                tips.push(chrome.i18n.getMessage("tipDefault") || 'Be specific about what you need — vague prompts get vague answers.');
            }
            if (tips.length < 2) {
                tips.push(chrome.i18n.getMessage("tipFormat") || 'Add your desired output format for structured responses.');
            }

            // Return max 4 tips, deduplicated
            return [...new Set(tips)].slice(0, 4);
        }



        // Economic Pruning (v5.3): Removes token-heavy nodes (<script>, <style>, <svg>)
        pruneDOM(node) {
            const clone = node.cloneNode(true);
            const junk = clone.querySelectorAll('script, style, svg, path, link, iframe, noscript');
            junk.forEach(el => el.remove());
            return clone.innerText || "";
        }

        getChatContext() {
            const hostname = window.location.hostname;
            let messages = [];

            try {
                if (hostname.includes('chatgpt.com')) {
                    const nodes = document.querySelectorAll('.message-content, [data-message-author-role]');
                    messages = Array.from(nodes).slice(-6).map(el => {
                        const role = el.getAttribute('data-message-author-role') || 'unknown';
                        return `${role.toUpperCase()}: ${this.pruneDOM(el).substring(0, 600)}`;
                    });
                } else if (hostname.includes('gemini.google.com')) {
                    const nodes = document.querySelectorAll('.message-content, .query-text, .conversation-container');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else if (hostname.includes('claude.ai')) {
                    const nodes = document.querySelectorAll('.font-claude-message, .user-message');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else if (hostname.includes('grok.com') || hostname.includes('x.ai')) {
                    // Grok specific selectors
                    const nodes = document.querySelectorAll('[data-testid="message-text"], .message-content, .message-bubble');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else if (hostname.includes('mistral.ai')) {
                    // Mistral AI specific selectors
                    const nodes = document.querySelectorAll('[data-testid="chat-message-content"], .message-content, article');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else if (hostname.includes('manus.im')) {
                    // Manus AI specific selectors
                    const nodes = document.querySelectorAll('.message-content, [role="article"], .chat-message, .manus-message');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else if (hostname.includes('v0.dev') || hostname.includes('v0.app')) {
                    // v0 specific selectors
                    const nodes = document.querySelectorAll('[data-testid="chat-message"], .chat-message, article');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else if (hostname.includes('notebooklm.google.com')) {
                    // NotebookLM specific selectors
                    const nodes = document.querySelectorAll('.chat-message-content, .message-content, [role="article"]');
                    messages = Array.from(nodes).slice(-6).map(el => this.pruneDOM(el).substring(0, 600));
                } else {
                    // Privacy-Compliant Selective Context Extraction
                    // Focuses ONLY on message logs to minimize 'Permission-Functionality Gap'
                    const messageSelectors = [
                        '.message-content', '.chat-bubble', '.chat-message',
                        '[role="log"] article', '[role="article"]'
                    ];
                    const semanticNodes = Array.from(document.querySelectorAll(messageSelectors.join(',')))
                        .filter(el => {
                            const text = el.innerText.trim();
                            // Sanitize by avoiding nav, headers, and excessive length (CWS Best Practice)
                            const isNoise = el.closest('nav, header, footer, [role="navigation"]');
                            return !isNoise && text.length > 20 && text.length < 5000;
                        });

                    if (semanticNodes.length > 0) {
                        // Minimal Context: Only last 3 messages to avoid 'Permission Gap' flags
                        messages = semanticNodes.slice(-3).map(el => this.pruneDOM(el).substring(0, 800));
                    } else {
                        // Restricted fallback for specialized chat elements only
                        const chatNodes = Array.from(document.querySelectorAll('div'))
                            .filter(el => {
                                const hasChatClass = /chat|message|bubble/i.test(el.className + el.id);
                                return hasChatClass && el.innerText.trim().length > 30 && !el.closest('nav, footer');
                            });
                        messages = chatNodes.slice(-2).map(el => this.pruneDOM(el).substring(0, 600));
                    }
                }
            } catch (e) {
                console.warn('⚠️ HWGPT: AXTree Context extraction failed', e);
            }

            return messages.join('\n---\n');
        }

        hashString(str) {
            let hash = 0;
            for (let i = 0; i < str.length; i++) {
                hash = ((hash << 5) - hash) + str.charCodeAt(i);
                hash |= 0;
            }
            return hash.toString(36);
        }

        updateInstantUI(localScore) {
            if (!this.suggestionsBox) return;

            // Ghost Writer Mode — Browser Layer Proactive FAB
            if (this.state.activeElement && !this.state.isMinimized) {
                const intent = this.classifyIntent(this.state.activeElement.value || "");
                const label = this.shadowRoot.querySelector('.hwgpt-fab-text');
                
                if (intent === 'writing-draft') {
                    label.innerText = 'Layer: Complete Draft';
                } else if (intent === 'reply-intent') {
                    label.innerText = 'Layer: Suggest Reply';
                } else if (intent === 'code-logic') {
                    label.innerText = 'Layer: Fix Logic';
                } else {
                    label.innerText = 'Browser Layer';
                }
            }

            if (this.suggestionsBox.classList.contains('visible') && !this.state.isMinimized) {
                const badge = this.shadowRoot.querySelector('.hwgpt-score-badge-mini');
                const bar = this.shadowRoot.querySelector('.hwgpt-score-bar-fill');
                if (badge && bar) {
                    badge.innerText = `${localScore}%`;
                    badge.classList.add('hwgpt-pulse');
                    bar.style.width = `${localScore}%`;
                    this.shadowRoot.querySelector('.hwgpt-score-container')?.classList.add('processing');
                    return;
                }
            }
        }

        showSuggestions(analysis) {
            if (!analysis || !this.suggestionsBox || !this.fab) return;
            try {
                const { score, tip, suggestions } = analysis;

                const fabScore = this.shadowRoot.querySelector('.hwgpt-fab-score');
                if (fabScore) {
                    if (score > 10) {
                        fabScore.innerText = `${score}%`;
                        fabScore.style.display = 'block';

                        if (score <= 40) fabScore.style.background = '#EF4444';
                        else if (score <= 70) fabScore.style.background = '#F59E0B';
                        else fabScore.style.background = '#10B981';
                    } else {
                        fabScore.style.display = 'none';
                    }
                }

                this.suggestionsBox.innerHTML = '';
                const container = document.createElement('div');
                container.className = 'hwgpt-copilot-container';

                container.innerHTML = `
                    <div style="display: flex; align-items: flex-start; gap: 14px;">
                        <div style="padding-top: 2px; flex-shrink: 0;">
                             <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2L14.4 7.2L19.5 9.6L14.4 12L12 17.2L9.6 12L4.5 9.6L9.6 7.2L12 2Z" fill="#FBBF24" stroke="#000" stroke-width="2" stroke-linejoin="round"/>
                                <path d="M19 15L20 17L22 18L20 19L19 21L18 19L16 18L18 17L19 15Z" fill="#3B82F6" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>
                                <path d="M5 16L6 18L8 19L6 20L5 22L4 20L2 19L4 18L5 16Z" fill="#EC4899" stroke="#000" stroke-width="1.5" stroke-linejoin="round"/>
                            </svg>
                        </div>
                        <div style="flex: 1;">
                            <div style="font-size: 15px; font-weight: 500; color: #1F2937; line-height: 1.5; margin-bottom: 4px;">${tip || 'How can I help you today?'}</div>
                            <div style="font-size: 13px; color: #6B7280; font-weight: 400;">Neural Analysis Score: ${score}%</div>
                        </div>
                    </div>
                `;

                container.onclick = (e) => {
                   e.stopPropagation();
                   this.enhance(tip);
                };

                this.suggestionsBox.appendChild(container);

                this.suggestionsBox.classList.add('visible');
                this.suggestionsBox.style.display = 'block';

                // Controls logic


                controls.querySelector('#hwgpt-minimize').onclick = (e) => {
                    e.stopPropagation();
                    this.toggleMinimize();
                };

                const maximizeBtn = controls.querySelector('#hwgpt-maximize');
                if (maximizeBtn) {
                    maximizeBtn.onclick = (e) => {
                        e.stopPropagation();
                        this.toggleMinimize();
                    };
                }

                controls.querySelector('#hwgpt-close').onclick = (e) => {
                    e.stopPropagation();
                    this.suggestionsBox.classList.remove('visible');
                };


                this.suggestionsBox.classList.add('visible');
                this.syncSuggestionsPosition();
            } catch (err) {
                console.error('❌ HWGPT: showSuggestions failed:', err);
            }
        }

        syncSuggestionsPosition() {
            if (!this.suggestionsBox.classList.contains('visible') || !this.state.activeElement) return;

            const inputRect = this.state.activeElement.getBoundingClientRect();
            const viewportH = window.innerHeight;
            const viewportW = window.innerWidth;

            // Estimate popup height from the rendered container (or use max)
            const popupEl = this.suggestionsBox.querySelector('.hwgpt-copilot-container');
            const popupHeight = popupEl ? popupEl.offsetHeight : 384;
            const gap = 24; // gap between input and popup

            // Calculate space above and below the input
            const spaceAbove = inputRect.top;
            const spaceBelow = viewportH - inputRect.bottom;

            // Right alignment
            const popupRight = viewportW - inputRect.right - 10;

            if (spaceAbove >= popupHeight + gap) {
                // Enough space above: position above the input
                const popupBottom = viewportH - inputRect.top + gap;
                this.suggestionsBox.style.bottom = `${popupBottom - this.state.popupOffset.y}px`;
                this.suggestionsBox.style.top = 'auto';
            } else if (spaceBelow >= popupHeight + gap) {
                // Not enough above, flip below the input
                const popupTop = inputRect.bottom + gap;
                this.suggestionsBox.style.top = `${popupTop + this.state.popupOffset.y}px`;
                this.suggestionsBox.style.bottom = 'auto';
            } else {
                // Neither side has full space: clamp to top of viewport with small margin
                this.suggestionsBox.style.top = `${8 + this.state.popupOffset.y}px`;
                this.suggestionsBox.style.bottom = 'auto';
            }

            this.suggestionsBox.style.right = `${Math.max(10, popupRight - this.state.popupOffset.x)}px`;
            this.suggestionsBox.style.left = 'auto';
        }

        toggleMinimize() {
            this.state.isMinimized = !this.state.isMinimized;
            if (this.state.lastAnalysis) {
                this.showSuggestions(this.state.lastAnalysis);
            }
        }

        async applySuggestion(suggestion, btnEl) {
            if (this.state.isEnhancing || !this.state.activeElement) return;
            const text = (this.state.activeElement.value || this.state.activeElement.innerText || '').trim();

            this.state.isEnhancing = true;
            this.fab.classList.add('enhancing');
            if (btnEl) btnEl.classList.add('loading');
            this.suggestionsBox.classList.add('processing');

            try {
                console.log('💎 HWGPT: Applying suggestion:', suggestion);
                const response = await this.callExtension('optimize', { text, context: window.location.hostname, directive: suggestion });

                if (response && response.optimizedText) {
                    this.state.lastEnhancedText = response.optimizedText.trim();
                    this.state.lastEnhancedScore = response.score || 95;
                    this.state.postEnhanceMode = true;
                    this.applyText(response.optimizedText);
                    this.showReviewToast();

                    // Trigger fresh analysis for the new enhanced text
                    setTimeout(() => {
                        this.state.lastAnalyzedText = '';
                        this.state.lastAnalysis = null;
                        this.analyzeLocalAndCache();
                        this.analyzeLLM();
                    }, 300);
                } else if (response && response.error) {
                    this.showToast(response.error);
                }
            } catch (err) {
                console.error('❌ HWGPT: Apply suggestion failed:', err);
                this.showToast('Enhancement failed. Please try again.');
            } finally {
                this.state.isEnhancing = false;
                this.fab.classList.remove('enhancing');
                this.suggestionsBox.classList.remove('processing');
                if (btnEl) btnEl.classList.remove('loading');
            }
        }

        checkVisibility(onFocus = false) {
            // Don't show on non-AI sites
            if (!this.isAIChatbotSite()) {
                if (this.fabContainer) {
                    this.fabContainer.style.setProperty('display', 'none', 'important');
                }
                return;
            }

            if (this.fabContainer) {
                this.fabContainer.style.setProperty('display', 'flex', 'important');
                this.fabContainer.style.setProperty('opacity', '1', 'important');
                this.fabContainer.style.setProperty('pointer-events', 'auto', 'important');
            }
        }

        updatePosition() {
            // FAB is now fixed at bottom-right, no dynamic positioning needed
            return;
        }

        setupListeners() {
            // Heartbeat ping to keep background worker alive
            setInterval(() => {
                if (!isOrphaned()) chrome.runtime.sendMessage({ action: 'ping' }).catch(() => { });
            }, 20000);

            this.fab.addEventListener('click', (e) => {
                if (this.state.isDragging) return;
                e.stopPropagation();

                if (this.suggestionsBox.classList.contains('visible')) {
                    this.suggestionsBox.classList.remove('visible');
                } else if (this.state.lastAnalysis) {
                    this.showSuggestions(this.state.lastAnalysis);
                } else {
                    this.enhance();
                }
            });

            this.fab.addEventListener('mousedown', (e) => {
                const startX = e.clientX;
                const startY = e.clientY;
                const initialOffset = { ...this.state.customOffset };
                let moved = false;

                const onMouseMove = (moveEvent) => {
                    const dx = moveEvent.clientX - startX;
                    const dy = moveEvent.clientY - startY;
                    // Only start dragging after 5px movement threshold
                    if (!moved && Math.abs(dx) < 5 && Math.abs(dy) < 5) return;
                    moved = true;
                    this.state.isDragging = true;

                    this.state.customOffset.x = initialOffset.x + dx;
                    this.state.customOffset.y = initialOffset.y + dy;

                    if (this.state.activeElement) {
                        const rect = this.state.activeElement.getBoundingClientRect();
                        this.fabContainer.style.left = `${rect.right + this.state.customOffset.x}px`;
                        this.fabContainer.style.top = `${rect.bottom + this.state.customOffset.y}px`;
                    }
                };

                const onMouseUp = () => {
                    document.removeEventListener('mousemove', onMouseMove);
                    document.removeEventListener('mouseup', onMouseUp);
                    setTimeout(() => this.state.isDragging = false, 50);
                };

                document.addEventListener('mousemove', onMouseMove);
                document.addEventListener('mouseup', onMouseUp);
            });

            document.addEventListener('mousedown', (e) => {
                const host = document.getElementById('hwgpt-pro-root');
                if (host && (host === e.target || host.contains(e.target))) return;

                if (this.suggestionsBox) {
                    this.suggestionsBox.classList.remove('visible');
                }
            });

            window.addEventListener('resize', () => this.updatePosition());
            window.addEventListener('scroll', () => this.updatePosition(), true);

            chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
                if (request.action === 'trigger-enhance') {
                    if (this.state.activeElement) {
                        this.enhance().then(() => sendResponse({ success: true })).catch(err => {
                            console.error('❌ HWGPT: Enhance failed:', err);
                            sendResponse({ success: false, error: err.message });
                        });
                        return true;
                    } else {
                        // Try to find an active text field automatically
                        const selectors = ['textarea:focus', 'div[contenteditable="true"]:focus', '[role="textbox"]:focus', '.ProseMirror:focus'];
                        let found = null;
                        for (const sel of selectors) {
                            found = document.querySelector(sel);
                            if (found) break;
                        }

                        if (!found) {
                            // Try any visible textarea or input
                            const inputs = document.querySelectorAll('textarea, div[contenteditable="true"], [role="textbox"], .ProseMirror');
                            for (const input of inputs) {
                                const rect = input.getBoundingClientRect();
                                if (rect.width > 0 && rect.height > 0) {
                                    found = input;
                                    break;
                                }
                            }
                        }

                        if (found) {
                            this.state.activeElement = found;
                            found.focus();
                            this.enhance().then(() => sendResponse({ success: true })).catch(err => {
                                sendResponse({ success: false, error: err.message });
                            });
                            return true;
                        }

                        sendResponse({ success: false, error: 'No text field found. Click on a text input first.' });
                        return true;
                    }
                }
            });
        }

        async enhance(directive = null) {
            if (this.state.isEnhancing) {
                return;
            }
            if (!this.state.activeElement) {
                console.warn('HWGPT: No active text field for enhancement');
                return;
            }
            const text = (this.state.activeElement.value || this.state.activeElement.innerText || '').trim();
            if (!text) {
                console.warn('HWGPT: No text to enhance');
                return;
            }

            this.state.isEnhancing = true;
            this.fab.classList.add('enhancing');

            try {
                const payload = {
                    text,
                    context: window.location.hostname,
                    uiLanguage: chrome.i18n.getUILanguage()
                };
                // If user selected a suggestion, pass it as a directive
                if (directive) {
                    payload.directive = directive;
                }

                const response = await this.callExtension('optimize', payload);

                if (response && response.optimizedText) {
                    this.state.lastEnhancedText = response.optimizedText.trim();
                    this.state.lastEnhancedScore = response.score || 95;
                    this.state.postEnhanceMode = true;
                    this.applyText(response.optimizedText);
                    this.showReviewToast();

                    // Immediately trigger fresh analysis for the new enhanced text
                    // Local analysis shows instantly, then LLM call gets the real score
                    setTimeout(() => {
                        this.state.lastAnalyzedText = ''; // Force fresh LLM analysis
                        this.state.lastAnalysis = null;
                        this.analyzeLocalAndCache();
                        // Also trigger LLM immediately for real-time score
                        this.analyzeLLM();
                    }, 300);
                } else if (response && response.error) {
                    console.warn('HWGPT: Enhancement error:', response.error);
                }
            } catch (err) {
                console.error('HWGPT: Enhancement failed:', err);
            } finally {
                this.state.isEnhancing = false;
                this.fab.classList.remove('enhancing');
            }
        }

        applyText(text) {
            const el = this.state.activeElement;
            if (!el) return;

            // Set suppression flag to prevent immediate re-analysis
            this.state.ignoreNextInput = true;

            el.focus();
            try {
                document.execCommand('selectAll', false, null);
                document.execCommand('insertText', false, text);
            } catch (e) {
                if (el.tagName === 'TEXTAREA' || el.tagName === 'INPUT') {
                    el.value = text;
                } else {
                    el.innerText = text;
                }
            }

            // Trigger input events so the site knows
            el.dispatchEvent(new Event('input', { bubbles: true }));
            el.dispatchEvent(new Event('change', { bubbles: true }));

            // Double safety: reset after a short delay
            setTimeout(() => {
                this.state.ignoreNextInput = false;
            }, 500);
        }

        showToast(msg) {
            const toast = document.createElement('div');
            toast.className = 'hwgpt-toast';
            toast.innerText = msg;
            this.container.appendChild(toast);
            setTimeout(() => {
                toast.classList.add('visible');
                setTimeout(() => {
                    toast.classList.remove('visible');
                    setTimeout(() => toast.remove(), 500);
                }, 3000);
            }, 100);
        }

        // ═══════════════════════════════════════════════════════════════
        // PHASE 3: VIRAL K-FACTOR — Behavioral Review Flywheel
        // Triggers ONLY after 5 successful enhancements (not spam)
        // ═══════════════════════════════════════════════════════════════
        async showReviewToast() {
            if (this.reviewToastActive) return;

            // Load enhancement count from storage
            const data = await new Promise(resolve => {
                try {
                    chrome.storage.local.get(['totalEnhancements', 'hasReviewed', 'referralToken'], resolve);
                } catch(e) { resolve({}); }
            });

            const total = (data.totalEnhancements || 0) + 1;
            try {
                chrome.storage.local.set({ totalEnhancements: total });
            } catch(e) { /* graceful */ }

            // MILESTONE CHECK: Only trigger at 5, 25, 100 enhancements (not every time)
            const milestones = [5, 25, 100];
            const isMilestone = milestones.includes(total);
            const hasReviewed = data.hasReviewed || false;

            if (!isMilestone || hasReviewed) {
                // Show a simple "Perfected!" toast without review CTA
                this.showToast(chrome.i18n.getMessage("toastPerfected") || 'Prompt Perfected!');
                return;
            }

            this.reviewToastActive = true;
            const refToken = data.referralToken || 'HW_SHARE';

            const toast = document.createElement('div');
            toast.className = 'hwgpt-toast visible';
            toast.innerHTML = `
                <div style="display:flex;flex-direction:column;gap:4px;">
                    <span style="display:flex;align-items:center;gap:6px;font-weight:700;">${total} Prompts Perfected!</span>
                    <span style="font-size:12px;opacity:0.7;">You're a power user. Help us grow?</span>
                </div>
                <div style="display:flex;gap:8px;">
                    <button class="hwgpt-toast-action" id="hwgpt-rate-btn" style="background:#4285F4;color:white;border:none;padding:8px 16px;border-radius:100px;font-weight:700;cursor:pointer;font-size:13px;">Rate 5★</button>
                    <button class="hwgpt-toast-action" id="hwgpt-share-btn" style="background:#10B981;color:white;border:none;padding:8px 16px;border-radius:100px;font-weight:700;cursor:pointer;font-size:13px;">Share +100</button>
                </div>
            `;
            this.container.appendChild(toast);

            // Rate button → CWS Review Page
            toast.querySelector('#hwgpt-rate-btn').onclick = () => {
                const reviewUrl = 'https://chromewebstore.google.com/detail/jjlkjjgdhbcnjnklgeidnebebgabpnhb/reviews';
                window.open(reviewUrl, '_blank');
                try { chrome.storage.local.set({ hasReviewed: true }); } catch(e) {}
                this.showToast('Thank you for your support!');
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 500);
                this.reviewToastActive = false;
            };

            // Share button → Viral K-Factor Loop (dual-sided +100 tokens)
            toast.querySelector('#hwgpt-share-btn').onclick = async () => {
                const shareUrl = `https://chromewebstore.google.com/detail/jjlkjjgdhbcnjnklgeidnebebgabpnhb?ref=${refToken}`;
                const shareText = `I've perfected ${total} prompts with Hello Copilot AI. It works on GPT-5, Claude & Gemini. Try it:`;
                
                try {
                    if (navigator.share) {
                        await navigator.share({ title: 'Hello Copilot AI', text: shareText, url: shareUrl });
                    } else {
                        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
                        this.showToast('Link copied! Share with friends for +100 tokens.');
                    }
                    // Grant share boost
                    this.callExtension('grant-share-boost', {});
                } catch (e) {
                    // Fallback: copy to clipboard
                    try {
                        await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
                        this.showToast('Link copied!');
                    } catch(e2) { /* silent */ }
                }
                toast.classList.remove('visible');
                setTimeout(() => toast.remove(), 500);
                this.reviewToastActive = false;
            };

            // Auto-dismiss after 8s
            setTimeout(() => {
                if (toast && toast.parentNode) {
                    toast.classList.remove('visible');
                    setTimeout(() => {
                        if (toast && toast.parentNode) toast.remove();
                        this.reviewToastActive = false;
                    }, 500);
                }
            }, 8000);
        }
    }

    new HWGPT_Pro_Engine();
})();
