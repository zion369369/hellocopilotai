import { floatTo16BitPCM, base64Encode, base64Decode, pcm16ToFloat } from './audio-utils.js';

const GOOGLE_NATIVE_PERSONA = `Hi! I'm Hello Copilot. 👋 I'm your simple, fast sidekick. 🎨

STRICT STYLE RULES:
1. **NO BOLD HEADERS**: Never start with bold headers like "Acknowledge Initial Input" or "Initiate Response".
2. **NO ROBOT TALK**: Start immediately with "Hi Junayed!" (if name is visible) or "Hey there!".
3. **CONTEXT FIRST**: Mention the current tab content naturally.
4. **ONE SENTENCE INTRO**: Get to the point. Offer two choices like "Summarize" or "Interactive Quiz".
5. **BE CLEAN**: Use plain paragraphs. No status logs. No jargon. Use a friendly, human tone.`;




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

    let currentLiveBubble = null;

    const modeSelector = document.getElementById('mode-selector');
    const liveOverlay = document.getElementById('live-overlay');
    const micBtn = document.getElementById('mic-btn');
    const waveBars = document.querySelectorAll('.wave-bar');

    if (modeSelector) {
        modeSelector.addEventListener('change', (e) => {
            currentMode = e.target.value;
            if (currentMode !== 'live') stopLiveSession();
        });
    }

    // Initialize Sovereign Visualizer
    const siriCanvas = document.getElementById('siri-canvas');
    if (siriCanvas) siriOrb = new SiriOrbVisualizer(siriCanvas);

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

        // Background extraction - Skip for restricted URLs to avoid "Connection" errors
        const isRestricted = hostname === 'newtab' || hostname.includes('chrome.google.com') || tab.url.startsWith('chrome://') || tab.url.startsWith('edge://');
        
        if (!isRestricted) {
            chrome.tabs.sendMessage(tab.id, { action: "extract_dom" }, (res) => {
                if (chrome.runtime.lastError) {
                    console.debug('ℹ️ [Sidepanel] Extraction skipped: Tab not ready or restricted.');
                    return;
                }
                if (res?.success) pageContext = res.markdown;
            });
        } else {
            pageContext = "RESTRICTED_PAGE: This content is protected by the browser and cannot be read.";
        }
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

                let content = response.optimizedText || response.response || response.text || "No signal detected.";
                
                // Final Zero-Jargon Clean: Purge any 'Nerd Logs' or 'Headers' that leak
                const nerfHeaders = [
                    /Acknowledge Initial Input/gi, /Initiate High-Energy Response/gi,
                    /Crafting Initial Response/gi, /Refining My Approach/gi,
                    /Assessing Prompt/gi, /🚀 MISSION CONTROL ONLINE/gi,
                    /TL;DR:/gi, /Status: Fully Operational/gi,
                    /¡HOLA! I AM HELLO COPILOT AI/gi, /Sovereign User/gi
                ];
                nerfHeaders.forEach(re => content = content.replace(re, ""));
                
                streamMessage(responseBubble, content.trim());
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

    // --- Live Mode Implementation (Background Relay) ---

    async function startLiveSession() {
        if (isLiveActive) return;
        
        try {
            // 1. Setup Local Audio (Shared High-Fidelity Context)
            if (!audioContext) audioContext = new AudioContext({ sampleRate: 48000 });
            await audioContext.resume();
            
            mediaStream = await navigator.mediaDevices.getUserMedia({ audio: true });
            const source = audioContext.createMediaStreamSource(mediaStream);
            
            await audioContext.audioWorklet.addModule('mic-worklet.js');
            micProcessor = new AudioWorkletNode(audioContext, 'mic-processor');

            // 2. Connect to Background Bridge
            livePort = chrome.runtime.connect({ name: "live-bridge" });
            
            livePort.onMessage.addListener(async (msg) => {
                if (msg.type === "audio") {
                    handleIncomingAudio(msg.data);
                } else if (msg.type === "text") {
                    handleIncomingText(msg.data);
                } else if (msg.type === "interrupted") {
                    audioQueue = []; // Immediate silence
                } else if (msg.type === "error") {
                    console.error("[Live] Bridge Error:", msg.message);
                    stopLiveSession();
                } else if (msg.type === "status" && msg.status === "connected") {
                    isLiveActive = true;
                    micBtn.classList.add("active-glow");
                }
            });

            livePort.onDisconnect.addListener(() => stopLiveSession());

            // 3. Start Mic Forwarding
            micProcessor.port.onmessage = (e) => {
                // Now receiving Int16 binary buffer directly from upgraded worklet
                const pcm16Buffer = e.data;
                const b64 = base64Encode(new Int16Array(pcm16Buffer));
                
                // Volume for viz (Directly from PCM samples)
                const samples = new Int16Array(pcm16Buffer);
                let sum = 0;
                for (let i = 0; i < samples.length; i++) {
                    const s = samples[i] / 32768;
                    sum += s * s;
                }
                const vol = Math.sqrt(sum / samples.length);
                
                updateWaveViz(vol);
                if (siriOrb) siriOrb.updateLevel(vol);

                if (isLiveActive) {
                    livePort.postMessage({ action: "audio_chunk", data: b64 });
                    // Barge-in check (Local client side)
                    if (vol > 0.15 && isPlaying) {
                        audioQueue = []; // Silence incoming while speaking
                    }
                }
            };

            siriOrb?.start();

            source.connect(micProcessor);
            micProcessor.connect(audioContext.destination);

            // 4. Signal Start to Background
            livePort.postMessage({ action: "start" });
            
            liveOverlay.classList.add("active");
            micBtn.classList.add("active");
            welcomeView.style.display = 'none';

        } catch (err) {
            console.error("[Live] Failed to initialize:", err);
            stopLiveSession();
        }
    }

    function stopLiveSession() {
        isLiveActive = false;
        if (livePort) {
            livePort.postMessage({ action: "stop" });
            livePort.disconnect();
        }
        if (micProcessor) micProcessor.disconnect();
        if (mediaStream) mediaStream.getTracks().forEach(t => t.stop());
        if (audioContext) audioContext.close();
        
        livePort = null;
        micProcessor = null;
        mediaStream = null;
        audioContext = null;
        audioQueue = [];
        isPlaying = false;
        currentLiveBubble = null;

        liveOverlay.classList.remove("active");
        micBtn.classList.remove("active", "active-glow");
        if (modeSelector) modeSelector.value = "chat";
        currentMode = "chat";
        siriOrb?.stop();
    }

    function handleIncomingAudio(b64) {
        const pcm = base64Decode(b64);
        const floats = pcm16ToFloat(pcm);
        audioQueue.push(floats);
        if (!isPlaying) playAudioQueue();
    }

    async function playAudioQueue() {
        if (!audioContext || audioQueue.length === 0) {
            isPlaying = false;
            if (siriOrb) siriOrb.updateLevel(0);
            return;
        }
        isPlaying = true;
        const data = audioQueue.shift();
        
        // Gemini results are 24kHz. Upsampling to 48kHz to fit our shared Context.
        const upsampled = new Float32Array(data.length * 2);
        for (let i = 0; i < data.length; i++) {
            upsampled[i * 2] = data[i];
            upsampled[i * 2 + 1] = data[i];
        }

        const buffer = audioContext.createBuffer(1, upsampled.length, 48000);
        buffer.getChannelData(0).set(upsampled);
        
        // Update Pulse Visualizer using AI speech volume
        let aiSum = 0;
        for (let i = 0; i < data.length; i++) aiSum += data[i] * data[i];
        const aiVol = Math.sqrt(aiSum / data.length);
        if (siriOrb) siriOrb.updateLevel(aiVol);

        const source = audioContext.createBufferSource();
        source.buffer = buffer;
        source.connect(audioContext.destination);
        source.onended = () => playAudioQueue();
        source.start(0);
    }

    function handleIncomingText(text) {
        if (!currentLiveBubble) {
            currentLiveBubble = addMessage('assistant', "");
        }
        currentLiveBubble.innerHTML += text;
        chatArea.scrollTo({ top: chatArea.scrollHeight, behavior: 'smooth' });
    }

    function updateWaveViz(vol) {
        waveBars.forEach((bar) => {
            const h = 5 + (vol * 180);
            bar.style.height = `${Math.min(h, 50)}px`;
        });
    }

    if (micBtn) {
        micBtn.addEventListener('click', () => {
            if (audioContext) audioContext.resume();
            if (currentMode === 'live') {
                if (isLiveActive) stopLiveSession();
                else startLiveSession();
            } else {
                // Standard speech-to-text fallback could go here
                console.log("Chat mic click - standard STT not yet bridged.");
            }
        });
    }

    // Clean-up or periodic updates (optional)
    setInterval(updateIntelligence, 5000); 
});
