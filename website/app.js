// website/app.js - Superior AI Experience
const API_KEY = 'AIzaSyBPUpKARzEf5E2BxTuH5M8w4YtnZH-PvcM'; 
const SUPERIOR_MODEL = "gemini-1.5-pro"; // Use Pro for Superior Intelligence

document.addEventListener('DOMContentLoaded', () => {
    // UI Elements
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const chatWrapper = document.getElementById('chat-wrapper');
    const welcomeSection = document.getElementById('welcome-section');
    const skillsHubBtn = document.getElementById('skills-hub-btn');
    const skillsModal = document.getElementById('skills-modal');
    const skillsCloseBtn = document.getElementById('skills-close-btn');
    const newChatBtn = document.getElementById('new-chat-btn');

    let chatHistory = [];

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';
    });

    // New Chat Logic
    if (newChatBtn) {
        newChatBtn.addEventListener('click', () => {
            chatHistory = [];
            messagesContainer.innerHTML = '';
            welcomeSection.style.display = 'flex';
            chatInput.value = '';
            chatInput.style.height = 'auto';
        });
    }

    // Skills Hub Logic
    const skillsGrid = document.getElementById('skills-grid');
    if (skillsHubBtn && skillsModal) {
        skillsHubBtn.addEventListener('click', async () => {
            skillsModal.classList.add('active');
            if (skillsGrid.dataset.loaded) return;
            try {
                const res = await fetch('skills-registry.json');
                const skills = await res.json();
                skillsGrid.innerHTML = '';
                skills.forEach(skill => {
                    const div = document.createElement('div');
                    div.style.cssText = "background: #f8f9fa; border: 1px solid #eee; border-radius: 20px; padding: 24px; transition: 0.2s; cursor: pointer;";
                    div.innerHTML = `
                        <div style="font-size: 2rem; margin-bottom: 12px;">${skill.icon}</div>
                        <h3 style="margin-bottom: 6px; font-family: 'Outfit'; font-weight: 700;">${skill.name}</h3>
                        <p style="color: #5f6368; font-size: 0.9rem; line-height: 1.5; margin-bottom: 12px;">${skill.description}</p>
                        <button style="width: 100%; height: 36px; border-radius: 12px; border: none; background: #000; color: #fff; font-weight: 600; font-size: 0.8rem; cursor: pointer;">Enable Skill</button>
                    `;
                    div.onclick = () => {
                        div.querySelector('button').textContent = "Skill Enabled ✓";
                        div.querySelector('button').style.background = "#4285f4";
                    };
                    skillsGrid.appendChild(div);
                });
                skillsGrid.dataset.loaded = "true";
            } catch (err) {
                skillsGrid.innerHTML = `<div style="color: #ea4335; padding: 20px; text-align: center;">Failed to load AI skills.</div>`;
            }
        });
        skillsCloseBtn.addEventListener('click', () => skillsModal.classList.remove('active'));
    }

    // Send Message Logic
    sendBtn.addEventListener('click', handleSendMessage);
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendMessage();
        }
    });

    async function handleSendMessage() {
        const text = chatInput.value.trim();
        if (!text) return;

        welcomeSection.style.display = 'none';
        addMessage('user', text);
        chatInput.value = '';
        chatInput.style.height = 'auto';
        
        let loadingDiv = addTypingIndicator();
        chatWrapper.scrollTo({ top: chatWrapper.scrollHeight, behavior: 'smooth' });
        
        try {
            chatHistory.push({ role: "user", parts: [{ text: text }] });

            const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${SUPERIOR_MODEL}:generateContent?key=${API_KEY}`;
            
            const res = await fetch(apiUrl, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: chatHistory,
                    systemInstruction: { parts: [{ text: "You are 'Hello Copilot', a superior AI built with profound intelligence. Provide clear, direct, and exceptionally helpful answers. Be professional and high-performance." }] },
                    generationConfig: { temperature: 0.7, topP: 0.95 }
                })
            });
            
            if (res.status === 429) throw new Error("Processing limit reached. Please wait a moment.");

            const data = await res.json();
            if (!res.ok) throw new Error(data.error?.message || "Internal failure");
            
            const modelContent = data.candidates?.[0]?.content;
            if (!modelContent) throw new Error("Safety Blocked");

            chatHistory.push(modelContent);
            
            let textFound = "";
            modelContent.parts.forEach(p => { if (p.text) textFound += p.text; });

            loadingDiv.remove();
            if (textFound) {
                addMessage('bot', textFound);
            }

        } catch (error) {
            loadingDiv.remove();
            addMessage('bot', `System: ${error.message}`);
        }
        
        chatWrapper.scrollTo({ top: chatWrapper.scrollHeight, behavior: 'smooth' });
    }

    function addMessage(role, text) {
        const div = document.createElement('div');
        div.className = `message ${role}`;
        div.innerHTML = `<div class="bubble">${markedSafe(text)}</div>`;
        messagesContainer.appendChild(div);
    }

    function addTypingIndicator() {
        const div = document.createElement('div');
        div.className = 'message bot loading-indicator';
        div.innerHTML = `
            <div style="font-size: 14px; font-weight: 500; color: #4285F4; display: flex; align-items: center; gap: 8px;">
                <span class="loading-dots"> Superior AI is processing</span>
            </div>
        `;
        messagesContainer.appendChild(div);
        return div;
    }

    // Simple text-to-html (Simplified for dashboard)
    function markedSafe(text) {
        return text.replace(/\n/g, '<br>')
                   .replace(/\*\*(.*?)\*\*/g, '<b>$1</b>')
                   .replace(/\*(.*?)\*/g, '<i>$1</i>');
    }
});
