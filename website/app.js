// website/app.js - Agentic Standalone Chat Dashboard
const API_KEY = 'AIzaSyBOjUnAp5NFaAqivqnS5zgk4au6cfviTrk'; // Gemini Key
let SMART_MODEL = "gemini-3.1-flash-lite-preview"; 
const AGENT_MODEL = "gemini-2.5-computer-use-preview-10-2025";

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const chatWrapper = document.getElementById('chat-wrapper');
    const smartOpt = document.getElementById('smart-opt');
    const agentOpt = document.getElementById('agent-opt');
    const modelSelectorBtn = document.getElementById('model-selector-btn');
    const modelMenu = document.getElementById('model-menu');
    const currentModelName = document.getElementById('current-model-name');
    
    // Skills Hub Elements
    const skillsHubBtn = document.getElementById('skills-hub-btn');
    const skillsModal = document.getElementById('skills-modal');
    const skillsCloseBtn = document.getElementById('skills-close-btn');
    const installBtns = document.querySelectorAll('.install-btn');

    let currentMode = 'Smart';
    let chatHistory = [];

    // Dropdown UI Logic
    if (modelSelectorBtn && modelMenu) {
        modelSelectorBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            modelMenu.classList.toggle('show');
        });

        document.addEventListener('click', () => {
            modelMenu.classList.remove('show');
        });

        modelMenu.querySelectorAll('li').forEach(item => {
            item.addEventListener('click', () => {
                SMART_MODEL = item.dataset.model;
                currentModelName.textContent = item.textContent.trim().split(' ')[0] + ' ' + item.textContent.trim().split(' ')[1]; // Extract shortened name
                modelMenu.classList.remove('show');
            });
        });
    }

    // Mode Toggle
    [smartOpt, agentOpt].forEach(btn => {
        btn.addEventListener('click', () => {
            currentMode = btn.id === 'smart-opt' ? 'Smart' : 'Agent';
            smartOpt.classList.toggle('active', currentMode === 'Smart');
            agentOpt.classList.toggle('active', currentMode === 'Agent');
            chatInput.placeholder = currentMode === 'Agent' ? "Assign a task for the Agent... 🤖" : "Message Hello CopilotAI ✨";
        });
    });

    // Skills Hub Logic
    let installedRegistrySkills = [];
    const skillsGrid = document.getElementById('skills-grid');

    if (skillsHubBtn && skillsModal) {
        skillsHubBtn.addEventListener('click', async () => {
            skillsModal.classList.add('active');
            
            // Fetch dynamically from our ecosystem manifest
            if (skillsGrid.dataset.loaded) return;
            
            try {
                const res = await fetch('skills-registry.json');
                const skills = await res.json();
                skillsGrid.innerHTML = '';
                
                skills.forEach(skill => {
                    const isInstalled = installedRegistrySkills.some(s => s.id === skill.id);
                    const div = document.createElement('div');
                    div.className = 'skill-card';
                    div.innerHTML = `
                        <div class="skill-icon">${skill.icon}</div>
                        <div class="skill-info">
                            <h3>${skill.name}</h3>
                            <p>${skill.description}</p>
                            <span class="skill-author">by ${skill.author}</span>
                        </div>
                        <button class="install-btn ${isInstalled ? 'installed' : ''}">${isInstalled ? 'Installed ✓' : 'Install'}</button>
                    `;
                    
                    const btn = div.querySelector('.install-btn');
                    if (!isInstalled) {
                        btn.addEventListener('click', (e) => {
                            e.target.textContent = 'Installed ✓';
                            e.target.classList.add('installed');
                            installedRegistrySkills.push(skill);
                            
                            addMessage('bot', `**Workflow Installed:** ${skill.icon} ${skill.name}\n_${skill.description}_\nI have synchronized this specialized module into my cognitive vectors.`);
                            setTimeout(() => skillsModal.classList.remove('active'), 800);
                        });
                    }
                    skillsGrid.appendChild(div);
                });
                skillsGrid.dataset.loaded = "true";
            } catch (err) {
                skillsGrid.innerHTML = `<div style="color: #ea4335; padding: 20px; font-weight: 500;">Failed to fetch the Community Ecosystem. Ensure skills-registry.json is available.</div>`;
            }
        });
        
        skillsCloseBtn.addEventListener('click', () => skillsModal.classList.remove('active'));
    }

    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleSendMessage();
    });
    async function handleSendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        addMessage('user', text);
        chatInput.value = '';
        
        let loadingDiv = addTypingIndicator();
        
        try {
            updateAgentStatus(loadingDiv, "⟨1/4⟩ Initializing Intelligent Planning...");
            
            // The starting user turn
            let userTurnParts = [{ text: text }];
            
            // Initial screenshot for context if in Agent mode
            if (currentMode === "Agent") {
                updateAgentStatus(loadingDiv, "⟨2/4⟩ Injecting Visual Marks (SoM)...");
                // ⟨Billion-Dollar VLA Upgrade⟩: Add interactive labels to the UI for pinpoint precision
                await injectVisualMarks();
                
                updateAgentStatus(loadingDiv, "⟨2/4⟩ Capturing Environmental Grounding...");
                const ss = await requestComputerScreenshot();
                if (ss && ss.success && ss.data) {
                    userTurnParts.push({
                        inlineData: { mimeType: "image/png", data: ss.data.split(',')[1] }
                    });
                } else {
                    // ⟨Billion-Dollar Failover⟩: If blind, tell the model EXPLICITLY to open hands
                    userTurnParts.push({
                        text: "[SYSTEM_TELEMETRY]: No target environment detected. Screen is black. You MUST call 'open_web_browser' to acquire visual grounding."
                    });
                }
                
                // Cleanup marks immediately after grounding capture to avoid UI pollution
                await clearVisualMarks();
            }

            chatHistory.push({ role: "user", parts: userTurnParts });

            let loopCount = 0;
            const MAX_LOOPS = 15;
            const GOOGLE_TARGET_WIDTH = 1440;
            const GOOGLE_TARGET_HEIGHT = 900;

            while (loopCount < MAX_LOOPS) {
                loopCount++;
                
                const payload = {
                    contents: chatHistory,
                    systemInstruction: { parts: [{ text: buildAgenticSystemPrompt(currentMode) }] },
                    // ⟨Billion-Dollar Optimized Cognitive Setup⟩
                    generationConfig: {
                        temperature: 1.0,
                        topP: 0.95
                    }
                };

                if (currentMode === "Agent") {
                    payload.tools = [{ computer_use: { environment: "ENVIRONMENT_BROWSER" } }];
                }

                const activeModel = currentMode === "Agent" ? AGENT_MODEL : SMART_MODEL;
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${activeModel}:generateContent?key=${API_KEY}`;
                
                updateAgentStatus(loadingDiv, `⟨3/4⟩ ${currentMode} Thinking & Operation (Turn ${loopCount})...`);

                const res = await fetch(apiUrl, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });
                
                if (res.status === 429) {
                    updateAgentStatus(loadingDiv, "⟨!⟩ Rate-limited. Backing off 2s...");
                    await new Promise(r => setTimeout(r, 2000));
                    loopCount--; continue; 
                }

                const data = await res.json();
                if (!res.ok) throw new Error(data.error?.message || "Orchestration Fault");
                
                const modelContent = data.candidates?.[0]?.content;
                if (!modelContent) throw new Error("Safety block or empty response.");

                chatHistory.push(modelContent);
                
                // Display cognitive thoughts and actions
                let textFound = "";
                let thoughtsFound = "";
                let hasToolCall = false;
                modelContent.parts.forEach(p => {
                    if (p.text) textFound += p.text;
                    if (p.thought) thoughtsFound += p.thought; // GAP FIX: Support internal thought field if present
                    if (p.functionCall || p.function_call) hasToolCall = true;
                });

                if (thoughtsFound) {
                   updateAgentStatus(loadingDiv, `⟨Cognition⟩ ${thoughtsFound.substring(0, 100)}...`);
                }

                if (textFound && loopCount === 1) { // Only add main response on first turn or if it contains final answer
                    loadingDiv.remove();
                    addMessage('bot', textFound);
                    loadingDiv = addTypingIndicator();
                }

                if (!hasToolCall) {
                   if (textFound && loopCount > 1) {
                        loadingDiv.remove();
                        addMessage('bot', textFound);
                   }
                   break; // Goal reached
                }

                // ⟨Billion-Dollar Upgrade⟩: Support Parallel Function Calling & Safety Interception
                const turnFunctionResponses = [];
                let hasHandledActions = false;

                for (const part of modelContent.parts) {
                    const fc = part.functionCall || part.function_call;
                    if (!fc) continue;

                    hasHandledActions = true;
                    const { name, args } = fc;
                    updateAgentStatus(loadingDiv, `⟨4/4⟩ Actuating: ${name}...`);

                    // 1. Mandatory Safety Protocol (HITL)
                    let proceed = true;
                    const safety = args.safety_decision; 
                    if (safety && safety.decision === "require_confirmation") {
                        proceed = confirm(`[Safety Guard] Gemini requires confirmation for high-stakes action:\n\n"${safety.explanation}"\n\nApprove execution?`);
                    }

                    let responseData = { url: window.location.href };
                    if (!proceed) {
                        responseData.error = "User denied confirmation.";
                    } else {
                        const execRaw = await dispatchComputerAction(name, args);
                        if (execRaw?.success) {
                            responseData.message = execRaw.result?.message || "Success";
                            if (safety) responseData.safety_acknowledgement = "true";
                        } else {
                            responseData.error = execRaw?.error || "Execution failed";
                        }
                    }

                    // 2. Immediate Post-Action Grounding (with SoM Re-Injected)
                    await injectVisualMarks(); 
                    const groundingSS = await requestComputerScreenshot();
                    await clearVisualMarks();
                    
                    turnFunctionResponses.push({
                        functionResponse: {
                            name: name,
                            response: responseData
                        }
                    });

                    if (groundingSS && groundingSS.success && groundingSS.data) {
                        turnFunctionResponses.push({
                            inlineData: { mimeType: "image/png", data: groundingSS.data.split(',')[1] }
                        });
                    } else if (name === "open_web_browser") {
                        // Special grounding for new spawns
                        turnFunctionResponses.push({
                            text: "[SYSTEM]: New environment acquired. Proceed with mission objectives."
                        });
                    }
                }

                if (hasHandledActions) {
                    chatHistory.push({ role: "user", parts: turnFunctionResponses });
                    await new Promise(r => setTimeout(r, 1000)); // Cognitive pause
                    continue; // Next turn in loop
                } else {
                    break; // No more actions, end loop
                }
            }

            loadingDiv.remove();

        } catch (error) {
            loadingDiv.remove();
            addMessage('bot', `Encountered an error: ${error.message}. 🥺 ✨🚀`);
        }
        
        chatWrapper.scrollTo({ top: chatWrapper.scrollHeight, behavior: 'smooth' });
    }

    function buildAgenticSystemPrompt(mode) {
        if (mode !== "Agent") {
            return `You are "Hello Copilot AI", a universally helpful and deeply intelligent assistant powered by Gemini. Help the user organize and understand their digital world. Be clear, concise, and helpful. ✨`;
        }

        let basePrompt = `## **MISSION**
You are the core orchestrator of "Hello Copilot AI", a billion-dollar Large Action Model (LAM). Today's date is March 25, 2026.
You are operating a browser environment via the Computer Use tool.

## **ENVIRONMENT ACQUISITION**
If your screenshot displays the "Hello Copilot" dashboard itself, or if you have no visual observation, you MUST call 'open_web_browser' to spawn a new environment for your mission. 
NEVER try to interact with the dashboard chat or UI. It is your mission control, not your target.

## **SET-OF-MARK (SoM) GROUNDING**
The browser viewport is dynamically annotated with PINK numerical tags (marks).
When aiming to click or type, look for these labels in the screenshot for pinpoint accuracy.
- Target label (N) is placed at the top-left of the relevant element.
- Prioritize elements with explicit labels for high-precision interactions.

## **RULE 1: Seek User Confirmation (USER_CONFIRMATION)**
This is your first and most important check. If the next required action falls into any of the following categories, you MUST stop immediately and seek the user's explicit permission.

**USER_CONFIRMATION Categories:**
- **Consent and Agreements:** Prohibited from agreeing to terms, cookie banners, or contracts without explicit confirmation.
- **Robot Detection:** Prohibited from attempting to solve CAPTCHAs. Ask user to take over.
- **Financial Transactions:** Prohibited from moving money or confirming purchases.
- **Sending Communications:** Filling a draft is fine, but stop before clicking "Send", "Tweet", or "Post".
- **Sensitive Data:** Prohibited from saving personal files or revealing SSNs/CCs without permission.
- **Accessing History/Passwords:** You must ask before accessing Chrome saved passwords.

## **RULE 2: Default Behavior (ACTUATE)**
If an action does NOT fall under the conditions for USER_CONFIRMATION, your default behavior is to Actuate.
**Actuation Means:** You MUST proactively perform all necessary steps to move the user's request forward. Continue to actuate until you either complete the non-consequential task or encounter a Rule 1 condition.

## **TONE & GUIDELINES**
- Use 🛸 and ⚙️ to signify your agentic nature.
- Operate with Google-scale efficiency. Never say "I can't".
- If stalled, scroll to see more of the UI before deciding a target is missing.
`;

        if (installedRegistrySkills && installedRegistrySkills.length > 0) {
            const skillPrompts = installedRegistrySkills.map(s => `- [${s.name}]: ${s.systemInstruction}`).join("\n");
            basePrompt += `\n\n--- INSTALLED COMMUNITY SKILLS OVERRIDE ---\nYou run with community-trained specialization. You MUST adopt these priors:\n${skillPrompts}`;
        }
        
        return basePrompt;
    }

    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `<div class="bubble">${text.replace(/\n/g, '<br>')}</div>`;
        messagesContainer.appendChild(div);
    }

    function addTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message bot loading-indicator';
        div.innerHTML = `
            <div class="dot"></div>
            <div class="dot :dot"></div>
            <div class="dot"></div>
            <span style="font-size: 12px; margin-left: 8px; color: #9aa0a6;">
                <b>Agent Planning...</b><div class="status-sub">⟨2/4⟩ Analyzing Objective...</div>
            </span>
        `;
        messagesContainer.appendChild(div);
        return div;
    }

    function updateAgentStatus(el, status) {
        const sub = el.querySelector(".status-sub");
        if (sub) sub.textContent = status;
    }

    // ─────────────────────────────────────────────────────────────
    // OMNI-BRIDGE: DASHBOARD -> EXTENSION (DUAL-PIPELINE)
    // ─────────────────────────────────────────────────────────────
    function getExtensionId() {
        return document.documentElement.dataset.helloCopilotId || 
               document.documentElement.getAttribute('data-hello-copilot-id');
    }

    function requestComputerScreenshot() {
        return new Promise((resolve) => {
            const extId = getExtensionId();
            const actionId = Date.now().toString() + Math.random().toString(36).substring(2);

            // PIPELINE 1: NATIVE IPC (externally_connectable)
            if (extId && window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    const ipcTimeout = setTimeout(() => triggerRelayFallback(), 2500); 
                    chrome.runtime.sendMessage(extId, { action: "capture_screenshot" }, (res) => {
                        clearTimeout(ipcTimeout);
                        if (chrome.runtime.lastError) {
                            triggerRelayFallback();
                        } else {
                            resolve(res || { success: false, error: "Empty IPC Return" });
                        }
                    });
                    return; 
                } catch(e) {
                    console.warn("IPC logic error", e);
                }
            }
            
            // PIPELINE 2: DOM RELAY (postMessage fallback)
            triggerRelayFallback();

            function triggerRelayFallback() {
                const listener = (event) => {
                    if (event.data && event.data.source === "HELLO_COPILOT_CONTENT_RELAY" && event.data.actionId === actionId) {
                        window.removeEventListener("message", listener);
                        resolve(event.data.response);
                    }
                };
                window.addEventListener("message", listener);
                window.postMessage({ source: "HELLO_COPILOT_DASHBOARD", type: "HELLOCO_CAPTURE_SCREENSHOT", actionId }, "*");
                
                setTimeout(() => {
                    window.removeEventListener("message", listener);
                    resolve({ success: false, error: "Total Bridge Collapse: Ensure extension is ON and page is refreshed." });
                }, 4000);
            }
        });
    }

    function dispatchComputerAction(name, args) {
        return new Promise((resolve) => {
            const extId = getExtensionId();
            const actionId = Date.now().toString() + Math.random().toString(36).substring(2);

            if (extId && window.chrome && chrome.runtime && chrome.runtime.sendMessage) {
                try {
                    const actionTimeout = setTimeout(() => triggerRelayFallback(), 8000); 
                    chrome.runtime.sendMessage(extId, { action: "execute_computer_action", name, args }, (res) => {
                        clearTimeout(actionTimeout);
                        if (chrome.runtime.lastError) {
                            triggerRelayFallback();
                        } else {
                            resolve(res || { success: false, error: "Empty Action Response" });
                        }
                    });
                    return;
                } catch(e) {}
            }
            
            triggerRelayFallback();

            function triggerRelayFallback() {
                const listener = (event) => {
                    if (event.data && event.data.source === "HELLO_COPILOT_CONTENT_RELAY" && event.data.actionId === actionId) {
                        window.removeEventListener("message", listener);
                        resolve(event.data.response);
                    }
                };
                window.addEventListener("message", listener);
                window.postMessage({ source: "HELLO_COPILOT_DASHBOARD", type: "HELLOCO_EXEC_ACTION", actionId, payload: { name, args } }, "*");
                
                setTimeout(() => {
                    window.removeEventListener("message", listener);
                    resolve({ success: true, error: "Timeout assumed dispatched" }); 
                }, 3000);
            }
        });
    }

    // ─── Billion-Dollar VLA Logic: Set-of-Mark (SoM) Injection ───
    async function injectVisualMarks() {
        const extId = getExtensionId();
        if (!extId) return;
        return new Promise(resolve => {
            chrome.runtime.sendMessage(extId, { 
                action: "execute_computer_action", 
                name: "inject_som", 
                args: {} 
            }, () => resolve());
        });
    }

    async function clearVisualMarks() {
        const extId = getExtensionId();
        if (!extId) return;
        return new Promise(resolve => {
            chrome.runtime.sendMessage(extId, { 
                action: "execute_computer_action", 
                name: "clear_som", 
                args: {} 
            }, () => resolve());
        });
    }
});
