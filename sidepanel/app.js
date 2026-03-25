// sidepanel/app.js - Browser Co-Pilot (Computer Use Enabled)
const API_KEY = "AIzaSyBOjUnAp5NFaAqivqnS5zgk4au6cfviTrk";
const SMART_MODEL = "gemini-3.1-flash-lite-preview";
const AGENT_MODEL = "gemini-2.5-computer-use-preview-10-2025";
let currentMode = "Smart";
let chatHistory = [];

document.addEventListener("DOMContentLoaded", () => {
    const userInput = document.getElementById("user-input");
    const sendBtn = document.getElementById("send-btn");
    const messagesDiv = document.getElementById("messages");
    const modeBtnText = document.getElementById("mode-dropdown-btn");
    const modeItems = document.querySelectorAll("#mode-dropdown .dropdown-item");

    // Mode Selection Logic
    modeItems.forEach(item => {
        item.addEventListener("click", (e) => {
            e.stopPropagation();
            currentMode = item.dataset.mode || "Smart";
            const title = item.querySelector(".dropdown-title").textContent;
            modeBtnText.innerHTML = `${title} <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" style="margin-left:4px;"><polyline points="6 9 12 15 18 9"></polyline></svg>`;
            modeBtnText.style.borderColor = currentMode === "Agent" ? "#1a73e8" : "";
            modeBtnText.style.color = currentMode === "Agent" ? "#1a73e8" : "";
            document.querySelectorAll(".dropdown-menu").forEach(m => m.classList.remove("show"));
        });
    });

    // Handle Sending
    sendBtn.addEventListener("click", handleSend);
    userInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    });

    async function handleSend() {
        const text = userInput.value.trim();
        if (!text) return;

        addMessage(text, "user");
        userInput.value = "";
        
        const typingMsg = addTypingIndicator();
        let currentPrompt = text;

        try {
            // STAGE 1: Visual Perception (Required for Computer Use)
            updateAgentStatus(typingMsg, "⟨1/4⟩ Capturing Environment View...");
            let screenshot = null;
            if (currentMode === "Agent") {
                const ssRes = await new Promise(resolve => chrome.runtime.sendMessage({ action: "capture_screenshot" }, resolve));
                if (ssRes.success) screenshot = ssRes.screenshot.split(',')[1]; // Base64 raw
            }

            // STAGE 2: Context Extraction
            updateAgentStatus(typingMsg, "⟨2/4⟩ Analyzing Page Context...");
            const domRes = await new Promise(resolve => chrome.runtime.sendMessage({ action: "extract_dom" }, resolve));
            const contextStr = domRes.success ? `[Site: ${domRes.hostname}]\n${domRes.markdown}` : "";

            // Prepare Request Parts
            let parts = [{ text: currentPrompt }];
            if (screenshot) {
                parts.push({ inlineData: { mimeType: "image/png", data: screenshot } });
                parts.push({ text: `Current Page Context:\n${contextStr}` });
            }

            chatHistory.push({ role: "user", parts });

            // STAGE 3: Generation (Call Gemini)
            updateAgentStatus(typingMsg, `⟨3/4⟩ ${currentMode === "Agent" ? "Agentic Execution" : "Smart Insight"} active...`);
            
            const url = `https://generativelanguage.googleapis.com/v1beta/models/${currentMode === "Agent" ? AGENT_MODEL : SMART_MODEL}:streamGenerateContent?alt=sse&key=${API_KEY}`;
            const sysInstr = buildSystemInstruction(currentMode, contextStr);

            const payload = {
                contents: chatHistory,
                systemInstruction: { parts: [{ text: sysInstr }] },
                generationConfig: { maxOutputTokens: 4096, temperature: currentMode === "Agent" ? 0.0 : 0.7 }
            };

            // Include Computer Use tool if in Agent Mode
            if (currentMode === "Agent") {
                payload.tools = [{ computer_use: { environment: "ENVIRONMENT_BROWSER" } }];
            }

            const response = await fetch(url, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (!response.ok) throw new Error(`API Error: ${response.statusText}`);

            // Streaming Logic (SSE)
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let aggregatedText = "";
            let buffer = "";
            let capturedFunctionCalls = [];

            while (true) {
                const { done, value } = await reader.read();
                if (done) break;
                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split("\n");
                buffer = lines.pop();

                for (const line of lines) {
                    if (line.startsWith("data: ")) {
                        const dataStr = line.substring(6).trim();
                        if (dataStr === "[DONE]") continue;
                        try {
                            const data = JSON.parse(dataStr);
                            const partText = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
                            aggregatedText += partText;
                            
                            // Capture Function Calls
                            const fCalls = data.candidates?.[0]?.content?.parts?.filter(p => p.functionCall || p.function_call);
                            if (fCalls && fCalls.length > 0) {
                                capturedFunctionCalls.push(...fCalls);
                            }
                        } catch (e) {}
                    }
                }
            }

            typingMsg.remove();
            
            // Build Proper Memory Vector for API Sequencing
            const memoryParts = [];
            if (aggregatedText) {
                memoryParts.push({ text: aggregatedText });
                addMessage(aggregatedText, "bot");
            }
            
            if (capturedFunctionCalls.length > 0) {
                memoryParts.push(...capturedFunctionCalls);
                handleAgenticFunctionCalls(capturedFunctionCalls, addTypingIndicator());
            }

            chatHistory.push({ role: "model", parts: memoryParts });

            // Automatically mock the function response so the memory chain allows next messages
            if (capturedFunctionCalls.length > 0) {
                const mockResponseParts = capturedFunctionCalls.map(f => {
                    const fc = f.functionCall || f.function_call;
                    return {
                        functionResponse: {
                            name: fc.name,
                            response: { success: true, status: "Browser action queued." }
                        }
                    };
                });
                chatHistory.push({ role: "user", parts: mockResponseParts });
            }

        } catch (error) {
            typingMsg.remove();
            addMessage(`I encountered an error: ${error.message}. 🥺 ✨🚀`, "bot");
        }
    }

    async function handleAgenticFunctionCalls(calls, typingMsg) {
        for (const call of calls) {
            const fc = call.functionCall || call.function_call;
            const { name, args } = fc;
            updateAgentStatus(typingMsg, `⟨4/4⟩ Action Requested: ${name}...`, true);
            console.log("[AGENT] Function Call:", name, args);
            // In this version, we log actions to the user while we prepare the automation layer.
            // For production computer use, we would route x,y to background clicking script.
        }
    }

    function buildSystemInstruction(mode, context) {
        if (mode === "Agent") {
            return `You are "hellocopilotai" in OMNIPOTENT AGENT MODE. 
ENVIRONMENT: Browser.
YOUR ROLE: Analyze the provided screenshot and DOM context to navigate and perform tasks. 
1. Break down user goals into a step-by-step 'Visionary Plan'.
2. Use tool calls (like click_at, type_text_at) with 0-999 normalized coordinates.
3. Be 100% decisive. 🛸✨🚀`;
        }
        return `You are "hellocopilotai", a cheerful and smart browser co-pilot. Help the user summarize, explain, and interact with the web. Emojis encouraged! ✨ ufo 🛸`;
    }

    // UI Helpers
    function addMessage(text, role) {
        const msg = document.createElement("div");
        msg.className = `message ${role}`;
        msg.innerHTML = `<div class="bubble">${text.replace(/\n/g, '<br>')}</div>`;
        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
    }

    function addTypingIndicator() {
        const msg = document.createElement("div");
        msg.className = "message bot";
        msg.innerHTML = `<div class="bubble typing"><b>Agent Planning...</b><div class="status-sub">⟨0/4⟩ Initializing...</div></div>`;
        messagesDiv.appendChild(msg);
        messagesDiv.scrollTop = messagesDiv.scrollHeight;
        return msg;
    }

    function updateAgentStatus(msgEl, status, highlight = false) {
        const sub = msgEl.querySelector(".status-sub");
        if (sub) {
            sub.textContent = status;
            if (highlight) sub.style.color = "#1a73e8";
        }
    }
});
