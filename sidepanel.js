// Hello World GPT - Command Center Logic (v5.1.5)

document.addEventListener('DOMContentLoaded', async () => {
    updateStats();
    checkAIMode();

    const inputTrigger = document.getElementById('input-trigger');
    if (inputTrigger) {
        inputTrigger.addEventListener('click', () => {
            // In a real extension, this might open the sidepanel wider or show a search input
            window.open('https://helloworldgpt.com', '_blank');
        });
    }
});

async function updateStats() {
    try {
        const data = await chrome.storage.local.get(['stats', 'lastVisit']);
        const stats = data.stats || { optimizedCount: 0, averageScore: 0, streak: 1 };
        
        // --- 📊 STATS UPDATE ---
        const optEl = document.getElementById('stat-optimized');
        const streakEl = document.getElementById('stat-streak');
        if (optEl) optEl.innerText = stats.optimizedCount || 0;
        if (streakEl) streakEl.innerText = `${stats.streak} 🔥`;

        // --- 🎯 GOAL / MILESTONE LOGIC (Algorithm Engineering) ---
        const currentCount = stats.optimizedCount || 0;
        const goalThreshold = currentCount < 10 ? 10 : (currentCount < 50 ? 50 : 100);
        const progress = Math.min((currentCount / goalThreshold) * 100, 100);
        
        const goalBar = document.getElementById('goal-bar');
        const goalProgress = document.getElementById('goal-progress');
        const goalText = document.getElementById('goal-text');

        if (goalBar) goalBar.style.width = `${progress}%`;
        if (goalProgress) goalProgress.innerText = `${currentCount}/${goalThreshold}`;
        
        if (currentCount >= goalThreshold) {
            if (goalText) {
                goalText.innerHTML = `🌟 **Goal Reached!** You've unlocked Elite Intelligence. <a href="#" id="rate-now" style="color: var(--google-blue);">Rate us 5-stars</a> to claim our permanent Pro Badge.`;
                document.getElementById('rate-now')?.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.open('https://chromewebstore.google.com/detail/jjlkjjgdhbcnjnklgeidnebebgabpnhb/reviews', '_blank');
                });
            }
        } else {
            if (goalText) {
                goalText.innerHTML = `Perfect **${goalThreshold - currentCount} more prompts** to unlock **Pro Intelligence** and a 5-star badge!`;
            }
        }

        // --- 🔗 VIRAL SHARING ---
        const shareBtn = document.getElementById('share-btn');
        if (shareBtn) {
            shareBtn.addEventListener('click', () => {
                const text = `I've perfected ${currentCount} prompts and built a ${stats.streak}-day streak with Hello Copilot! 🚀\n\nDownload the browser-native AI sidebar: hellocopilotai.com`;
                const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
                window.open(twitterUrl, '_blank');
            });
        }

    } catch (e) {
        console.warn('Failed to update stats:', e);
    }
}

async function checkAIMode() {
    // Optional: Update UI based on AI availability
}

// Listen for updates from background/content
chrome.runtime.onMessage.addListener((request) => {
    if (request.action === 'refresh-sidepanel') {
        updateStats();
    }
});
