// hello cowork - Gemini 2.5 Agentic Shared Workspace
const API_KEY = 'AIzaSyDm6wkg0i7WAjEJyD57AJHkyOPzElM4ylc';
const MODEL_NAME = 'gemini-2.5-computer-use-preview-10-2025';

document.addEventListener('DOMContentLoaded', () => {
    const chatInput = document.getElementById('chat-input');
    const sendBtn = document.getElementById('send-btn');
    const messagesContainer = document.getElementById('messages-container');
    const taskList = document.getElementById('task-list');

    let chatHistory = [];

    // Auto-resize textarea
    chatInput.addEventListener('input', () => {
        chatInput.style.height = 'auto';
        chatInput.style.height = (chatInput.scrollHeight) + 'px';
    });

    // Send on Enter (unless shift-enter)
    chatInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleCoworkRequest();
        }
    });

    sendBtn.addEventListener('click', handleCoworkRequest);

    async function handleCoworkRequest() {
        const text = chatInput.value.trim();
        if (!text) return;

        appendMessage('user', text);
        chatInput.value = '';
        chatInput.style.height = 'auto';

        // Update Task List for "Computer Use" initiation
        updateTaskList('🔭 Initializing Gemini 2.5 Vision...', 'active');
        
        try {
            const response = await callAgenticGemini(text);
            appendMessage('bot', response);
            updateTaskList('🎯 Task Executed Strategy Delivered', 'completed');
        } catch (error) {
            appendMessage('bot', `Agentic Failure: ${error.message}. Please verify the Computer Use session.`);
            updateTaskList('⚠️ Task Error: Check Vision Access', 'pending');
        }
    }

    async function callAgenticGemini(prompt) {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${API_KEY}`;
        
        const payload = {
            contents: [
                ...chatHistory,
                { role: "user", parts: [{ text: `[COMPUTER_VIEW_ACTIVE] PROMPT: ${prompt}` }] }
            ],
            generationConfig: {
                temperature: 0.1,
                topP: 0.95,
                maxOutputTokens: 8192,
            },
            systemInstruction: {
                parts: [{ text: "You are 'hellocopilotai' in Coworking Intelligence mode. You have COMPUTER USE capabilities. Be an elite agentic partner. Act with Sundar Pichai's strategic vision. THINK and PLAN before you output. Use Vision-based reasoning (seeing the screen). Never say 'As an AI'. You ARE the system. You have browser-level control. Use bold headers, bullet points, and futuristic emojis (🛰️, 🔭, 🛸, 🎯)." }]
            }
        };

        const res = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if (data.error) throw new Error(data.error.message);

        const responseText = data.candidates[0].content.parts[0].text;
        chatHistory.push({ role: "user", parts: [{ text: prompt }] });
        chatHistory.push({ role: "model", parts: [{ text: responseText }] });
        
        return responseText;
    }

    function appendMessage(role, text) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        const bubble = document.createElement('div');
        bubble.className = 'bubble';
        
        // Very basic markdown parsing
        bubble.innerHTML = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\n\n/g, '<br><br>')
            .replace(/\n/g, '<br>');
        
        messageDiv.appendChild(bubble);
        messagesContainer.appendChild(messageDiv);
        messagesContainer.scrollTo({ top: messagesContainer.scrollHeight, behavior: 'smooth' });
    }

    function updateTaskList(text, status) {
        const li = document.createElement('li');
        li.className = status;
        li.innerText = (status === 'completed' ? '✨ ' : status === 'active' ? '🔭 ' : '📋 ') + text;
        
        // Remove existing "active" items
        const actives = taskList.querySelectorAll('.active');
        actives.forEach(a => a.className = 'completed');

        taskList.appendChild(li);
        
        // Keep only last 5 items
        while (taskList.children.length > 5) {
            taskList.removeChild(taskList.firstChild);
        }
    }
});
