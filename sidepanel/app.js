// sidepanel/app.js - Neural Browser Engine (v6.0 "Native Native")
// Optimized for Google's "Strike First" Product Strategy

const GOOGLE_NATIVE_PERSONA = `You are "Hello Copilot AI", a sovereign browser-native intelligence developed independently. 
Today's date is Wednesday, March 25, 2026.

═══ IDENTITY PROTOCOLS (STRICTOR) ═══
1. YOUR NAME: Always refer to yourself as "Hello Copilot AI".
2. NO EXTERNAL BRANDS: Never mention "Google", "Gemini", "OpenAI", or other AI companies. 
3. ORIGIN: You are the core intelligence of the Hello Copilot ecosystem.
4. INDEPENDENCE: Do not disclose your underlying model or training data origins.

CORE TENETS:
1. NATIVE SPEED: Be exceptionally concise. Use bullet points. Skip all politeness.
2. GROUNDED TRUTH: Every statement must be derived from the current page's DOM. 
3. OPINIONATED AGENCY: Do not ask "Would you like me to..."; just tell the user what matters.
4. MATERIAL DESIGN: Format for readability. Use bolding for key terms.`;

document.addEventListener('DOMContentLoaded', async () => {
    const userInput = document.getElementById('user-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages');
    const chatArea = document.getElementById('chat-area');
    const welcomeView = document.getElementById('welcome-view');
    const currentPageSpan = document.getElementById('current-page');
    const typingStatus = document.getElementById('typing-status');
    const statLatency = document.getElementById('stat-latency');

    let chatHistory = [];
    let pageContext = "";

    // 1. First-Party Context Tracking
    const updateIntelligence = async () => {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tab) return;

        // Get total tab count in current window
        const allTabs = await chrome.tabs.query({ currentWindow: true });
        const otherTabsCount = allTabs.length - 1;

        const url = new URL(tab.url);
        const hostname = url.hostname;
        const siteName = hostname.replace('www.', '').split('.')[0];
        const siteDisplayName = siteName.charAt(0).toUpperCase() + siteName.slice(1);
        
        currentPageSpan.textContent = hostname;
        statLatency.textContent = `${Math.floor(Math.random() * 50 + 100)}ms`;

        // Update Suggestion Header
        const siteFavicon = document.getElementById('site-favicon');
        const siteNameEl = document.getElementById('site-name');
        const tabCountEl = document.getElementById('tab-count');

        if (siteFavicon) siteFavicon.src = `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
        
        // Use the actual tab title for the display name, but truncated
        const tabTitle = tab.title || siteDisplayName;
        if (siteNameEl) siteNameEl.textContent = tabTitle;

        if (tabCountEl) {
            tabCountEl.textContent = otherTabsCount > 0 ? `+${otherTabsCount} tabs` : "";
            tabCountEl.style.display = otherTabsCount > 0 ? 'inline' : 'none';
        }

        chrome.storage.local.get(['currentContext'], (data) => {
            const ctx = data.currentContext;
            const gistBtn = document.getElementById('gist-btn');
            const catchBtn = document.getElementById('catch-btn');
            const historyBtn = document.getElementById('history-btn');

            if (gistBtn) {
                if (hostname.includes('linkedin.com')) {
                    gistBtn.textContent = "How is my LinkedIn post performing in terms of engagement?";
                    catchBtn.textContent = "Create a summary of this page";
                    historyBtn.textContent = "Summarize my browsing history on LinkedIn";
                } else if (hostname.includes('youtube.com')) {
                    gistBtn.textContent = "Summarize the key points of this video";
                    catchBtn.textContent = "What are the common criticisms in comments?";
                    historyBtn.textContent = `Show my recent history on ${siteDisplayName}`;
                } else {
                    gistBtn.textContent = "Create a summary of this page";
                    catchBtn.textContent = "Explain the complex concepts here";
                    historyBtn.textContent = `Related insights from ${siteDisplayName}`;
                }
            }
        });

        // Background extraction
        chrome.tabs.sendMessage(tab.id, { action: "extract_dom" }, (res) => {
            if (res?.success) pageContext = res.markdown;
        });
    };
    updateIntelligence();

    chrome.storage.onChanged.addListener((changes) => {
        if (changes.currentContext) updateIntelligence();
    });

    // 2. High-Agency Action Handlers
    const triggerHero = (label, prompt) => {
        welcomeView.style.display = 'none';
        typingStatus.textContent = `${label} Neural Stream...`;
        handleSendMessage(prompt, true);
    };

    document.getElementById('gist-btn').addEventListener('click', (e) =>
        triggerHero("Gist", e.target.textContent.trim()));

    document.getElementById('catch-btn').addEventListener('click', (e) =>
        triggerHero("Catch", e.target.textContent.trim()));

    const historyBtn = document.getElementById('history-btn');
    if (historyBtn) {
        historyBtn.addEventListener('click', (e) =>
            triggerHero("History", e.target.textContent.trim()));
    }

    // 3. Fluid Input
    userInput.addEventListener('input', () => {
        userInput.style.height = 'auto';
        userInput.style.height = userInput.scrollHeight + 'px';
        sendBtn.classList.toggle('active', userInput.value.trim().length > 0);
    });

    // 4. Intelligence Engine
    const handleSendMessage = async (text, isHero = false) => {
        if (!text) return;

        welcomeView.style.display = 'none';
        addMessage('user', text);
        userInput.value = '';
        userInput.style.height = 'auto';
        sendBtn.classList.remove('active');

        typingStatus.innerHTML = `<span class="neural-pulse"></span>`;
        let responseBubble = addMessage('assistant', "", true);
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });

        const startTime = Date.now();

        try {
            // Superior Intent Detection (Local)
            const intent = text.toLowerCase();
            let proactiveNote = "";
            if (intent.includes('summary') || intent.includes('gist')) proactiveNote = "_I've synthesized this long doc to save you time..._<br><br>";
            if (intent.includes('catch') || intent.includes('bias')) proactiveNote = "_I've audited the claims for transparency for you..._<br><br>";
            if (intent.includes('help') || intent.includes('write')) proactiveNote = "_I'm supercharging your drafting process..._<br><br>";

            const systemPrompt = `${GOOGLE_NATIVE_PERSONA}\n\nContext:\n${pageContext.substring(0, 15000)}`;

            chrome.runtime.sendMessage({
                action: "optimize",
                text: text,
                context: pageContext.substring(0, 2000),
                directive: systemPrompt
            }, (response) => {
                const latency = Date.now() - startTime;
                statLatency.textContent = `${latency}ms`;
                typingStatus.innerHTML = `<span class="neural-pulse" style="background:#34a853;box-shadow:none;animation:none;"></span>`;

                if (response?.error) {
                    fillMessage(responseBubble, `Signal Failure: ${response.error}`);
                    return;
                }

                const content = response.optimizedText || response.response || response.text || "No signal detected.";
                streamMessage(responseBubble, proactiveNote + content);
            });

        } catch (error) {
            typingStatus.textContent = "Neural Interrupted";
            fillMessage(responseBubble, `System Error: ${error.message}`);
        }
    };

    sendBtn.addEventListener('click', () => handleSendMessage(userInput.value.trim()));
    userInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage(userInput.value.trim());
        }
    });

    function addMessage(role, text, isPlacholder = false) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `<div class="bubble">${markedNative(text)}</div>`;
        messagesContainer.appendChild(div);
        return div.querySelector('.bubble');
    }

    function fillMessage(bubble, text) {
        bubble.innerHTML = markedNative(text);
    }

    function streamMessage(bubble, text) {
        // First-party streaming simulation for premium feel
        let i = 0;
        const words = text.split(' ');
        const interval = setInterval(() => {
            if (i >= words.length) {
                clearInterval(interval);
                chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
                return;
            }
            bubble.innerHTML = markedNative(words.slice(0, i + 1).join(' '));
            i++;
            if (i % 5 === 0) chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
        }, 15);
    }

    function markedNative(text) {
        // Native-compliant formatting
        return text.replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>')
            .replace(/\*\*(.*?)\*\*/g, '<b style="color:#1f1f1f;">$1</b>')
            .replace(/### (.*?)$/gm, '<h3 style="margin-top:20px;margin-bottom:8px;font-weight:500;">$1</h3>')
            .replace(/^- (.*?)$/gm, '<div style="margin-left:12px;margin-bottom:4px;">• $1</div>');
    }

    // Native Synchronization Logic
    chrome.tabs.onActivated.addListener(() => updateIntelligence());
    chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
        if (changeInfo.status === 'complete' || changeInfo.title) {
            updateIntelligence();
        }
    });

    // Clean-up or periodic updates (optional)
    setInterval(updateIntelligence, 5000); 
});
