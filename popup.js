// PromptStudio - Google First Party Logic (v5.6.0)
const CONFIG = {
    STRIPE_PAYMENT_LINK: 'https://buy.stripe.com/test_7sY8wPaLZ8Ln8iG2n68Ra00',
    FREE_DAILY_LIMIT: 10,
    PLUS_DAILY_LIMIT: 20,
    API_BASE: 'https://asdkryvlvldcgolthnsq.supabase.co',
    VERSION: '5.6.0',
    SHARE_URL: 'https://helloworldgpt.com',
    SHARE_TEXT: "I'm using PromptStudio to get AI superpowers! Check it out: "
};

class StateManager {
    constructor() {
        this.state = {
            isPro: false,
            dailyUsage: 0,
            streak: 0,
            lastUsageDate: null,
            tier: 'Free',
            boostedLimitDate: null,
            hasSeenOnboarding: false
        };
    }

    async load() {
        const data = await chrome.storage.local.get([
            'isPro', 'proExpiry', 'dailyUsage', 'lastUsageDate', 'neuralStreak', 'tier', 'boostedLimitDate', 'hasSeenOnboarding', 'userId', 'supabaseUserId', 'userEmail'
        ]);

        if (data.isPro && data.proExpiry) {
            this.state.isPro = Date.now() < data.proExpiry;
        } else {
            this.state.isPro = data.isPro || false;
        }

        const today = new Date().toDateString();
        if (data.lastUsageDate !== today) {
            this.state.dailyUsage = 0;
            this.state.lastUsageDate = today;
            await chrome.storage.local.set({ dailyUsage: 0, lastUsageDate: today });
        } else {
            this.state.dailyUsage = data.dailyUsage || 0;
            this.state.lastUsageDate = data.lastUsageDate;
        }

        this.state.streak = data.neuralStreak || 0;
        this.state.tier = data.tier || 'Free';
        this.state.boostedLimitDate = data.boostedLimitDate;
        this.state.hasSeenOnboarding = data.hasSeenOnboarding || false;
        this.state.userId = data.userId;
        this.state.supabaseUserId = data.supabaseUserId;
        this.state.userEmail = data.userEmail;
        return this.state;
    }
}

class UIController {
    constructor(stateManager) {
        this.state = stateManager;
        this.elements = {};
        this.isAnimating = false;
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.render();

        if (!this.state.state.hasSeenOnboarding) {
            this.runOnboardingAnimation();
        }
    }

    cacheElements() {
        this.elements = {
            subscriptionBadge: document.getElementById('subscription-badge'),
            rankName: document.getElementById('rank-name'),
            rankIcon: document.getElementById('rank-icon'),
            usageCard: document.getElementById('usage-card'),
            usageCount: document.getElementById('usage-count'),
            usageBar: document.getElementById('usage-bar'),
            usageReset: document.getElementById('usage-reset'),
            statStreak: document.getElementById('stat-streak'),
            streakJourney: document.getElementById('streak-journey'),
            streakLineFill: document.getElementById('streak-line-fill'),
            magicEnhanceBtn: document.getElementById('magic-enhance'),
            tryExampleBtn: document.getElementById('try-example'),
            onboardingCard: document.getElementById('onboarding-card'),
            animPulse: document.getElementById('anim-pulse'),
            animTyping: document.getElementById('anim-typing'),
            animSparkle: document.getElementById('anim-sparkle'),
            animEnhanced: document.getElementById('anim-enhanced'),
            animStatus: document.getElementById('anim-status'),
            upgradeBtn: document.getElementById('upgrade-btn'),
            studentPlusBtn: document.getElementById('student-plus-btn'),
            sharePlusBtn: document.getElementById('share-plus-btn'),
            boostTitle: document.getElementById('boost-title'),
            boostDesc: document.getElementById('boost-desc'),
            proModal: document.getElementById('pro-modal'),
            studentModal: document.getElementById('student-modal'),
            plusModal: document.getElementById('plus-modal'),
            plusModalDesc: document.getElementById('plus-modal-desc'),
            shareGrid: document.getElementById('share-grid'),
            boostResetTimer: document.getElementById('boost-reset-timer'),
            boostTimeLeft: document.getElementById('boost-time-left'),
            checkoutBtn: document.getElementById('checkout-btn'),
            closeModalBtn: document.getElementById('close-modal'),
            closeStudentModalBtn: document.getElementById('close-student-modal'),
            closePlusModalBtn: document.getElementById('close-plus-modal'),
            shareTwitter: document.getElementById('share-twitter'),
            shareFacebook: document.getElementById('share-facebook'),
            shareInstagram: document.getElementById('share-instagram'),
            shareLinkedin: document.getElementById('share-linkedin'),
            shareNative: document.getElementById('share-native'),
            promoInput: document.getElementById('promo-code-input'),
            applyPromoBtn: document.getElementById('apply-promo-btn')
        };
    }

    bindEvents() {
        this.elements.magicEnhanceBtn.addEventListener('click', () => {
            if (!this.state.state.hasSeenOnboarding && !this.isAnimating) {
                this.runOnboardingAnimation();
            } else {
                this.handleEnhance();
            }
        });
        this.elements.tryExampleBtn.addEventListener('click', () => this.runOnboardingAnimation());
        this.elements.upgradeBtn.addEventListener('click', () => this.showModal('pro-modal'));
        this.elements.studentPlusBtn.addEventListener('click', () => this.showModal('student-modal'));
        this.elements.sharePlusBtn.addEventListener('click', () => {
            if (!this.elements.sharePlusBtn.classList.contains('locked')) {
                this.showModal('plus-modal');
            } else {
                this.showModal('plus-modal'); // Still show modal but it will be in "locked" state
            }
        });
        this.elements.checkoutBtn.addEventListener('click', async () => {
            // Get user ID from state (this.state.state is the actual state object)
            const supabaseUserId = this.state.state.supabaseUserId;
            const userId = this.state.state.userId;
            const userEmail = this.state.state.userEmail;
            
            // Prioritize authenticated Supabase user ID for secure linking
            let finalUserId = supabaseUserId || userId;
            
            if (!finalUserId) {
                // Show warning if not authenticated
                alert('Please sign in first to link your purchase to your account!');
                return;
            }
            
            const url = new URL(CONFIG.STRIPE_PAYMENT_LINK);
            // Always append client_reference_id so webhook can link the payment
            url.searchParams.append('client_reference_id', finalUserId);
            
            if (userEmail) {
                url.searchParams.append('prefilled_email', userEmail);
            }
            
            console.log('🛒 Opening checkout with userId:', finalUserId, 'email:', userEmail);
            chrome.tabs.create({ url: url.toString() });
            
            // Start checking for subscription after 5 seconds (give time for payment)
            setTimeout(() => this.startSubscriptionPolling(), 5000);
        });
        this.elements.closeModalBtn.addEventListener('click', () => this.hideModal('pro-modal'));
        this.elements.closeStudentModalBtn.addEventListener('click', () => this.hideModal('student-modal'));
        this.elements.closePlusModalBtn.addEventListener('click', () => this.hideModal('plus-modal'));
        this.elements.applyPromoBtn.addEventListener('click', () => this.handleApplyPromo());
        
        // Supabase Auth handlers
        this.setupAuthHandlers();

        this.elements.shareTwitter.addEventListener('click', () => this.handleViralShare('twitter'));
        this.elements.shareFacebook.addEventListener('click', () => this.handleViralShare('facebook'));
        this.elements.shareInstagram.addEventListener('click', () => this.handleViralShare('instagram'));
        this.elements.shareLinkedin.addEventListener('click', () => this.handleViralShare('linkedin'));
        this.elements.shareNative.addEventListener('click', () => this.handleViralShare('native'));

        [this.elements.proModal, this.elements.studentModal, this.elements.plusModal].forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) this.hideModal(modal.id);
            });
        });
    }

    setupAuthHandlers() {
        const authSigninBtn = document.getElementById('auth-signin-btn');
        const authSignupBtn = document.getElementById('auth-signup-btn');
        const authSignoutBtn = document.getElementById('auth-signout-btn');
        const authEmail = document.getElementById('auth-email');
        const authPassword = document.getElementById('auth-password');
        const authStatus = document.getElementById('auth-status');
        const authForm = document.getElementById('auth-form');
        const authLoggedIn = document.getElementById('auth-logged-in');
        const authUserEmail = document.getElementById('auth-user-email');

        const showStatus = (message, isError = false) => {
            if (authStatus) {
                authStatus.textContent = message;
                authStatus.style.color = isError ? '#ff6b6b' : '#4ade80';
                authStatus.style.display = 'block';
            }
        };

        const updateAuthUI = async () => {
            // Check if user is logged in
            chrome.runtime.sendMessage({ action: 'auth-get-user' }, (response) => {
                if (response?.success && response.user) {
                    // User is logged in
                    if (authForm) authForm.style.display = 'none';
                    if (authLoggedIn) {
                        authLoggedIn.style.display = 'block';
                        if (authUserEmail) authUserEmail.textContent = response.user.email;
                    }
                    // Store supabaseUserId for checkout
                    chrome.storage.local.set({ 
                        supabaseUserId: response.user.id,
                        userEmail: response.user.email 
                    });
                    this.state.state.supabaseUserId = response.user.id;
                    this.state.state.userEmail = response.user.email;
                } else {
                    // User is not logged in
                    if (authForm) authForm.style.display = 'block';
                    if (authLoggedIn) authLoggedIn.style.display = 'none';
                }
            });
        };

        // Check auth state on load
        updateAuthUI();

        // Sign In handler
        if (authSigninBtn) {
            authSigninBtn.addEventListener('click', async () => {
                const email = authEmail?.value?.trim();
                const password = authPassword?.value;

                if (!email || !email.includes('@')) {
                    showStatus('❌ Please enter a valid email', true);
                    return;
                }
                if (!password || password.length < 6) {
                    showStatus('❌ Password must be at least 6 characters', true);
                    return;
                }

                showStatus('🔄 Signing in...');
                authSigninBtn.disabled = true;

                chrome.runtime.sendMessage({ 
                    action: 'auth-signin', 
                    email, 
                    password 
                }, async (response) => {
                    authSigninBtn.disabled = false;
                    
                    if (response?.success) {
                        showStatus('✅ Signed in! Syncing subscription...');
                        await updateAuthUI();
                        
                        // Sync subscription after login
                        chrome.runtime.sendMessage({ action: 'sync-subscription' }, () => {
                            setTimeout(() => location.reload(), 1500);
                        });
                    } else {
                        showStatus(`❌ ${response?.error || 'Sign in failed'}`, true);
                    }
                });
            });
        }

        // Sign Up handler
        if (authSignupBtn) {
            authSignupBtn.addEventListener('click', async () => {
                const email = authEmail?.value?.trim();
                const password = authPassword?.value;

                if (!email || !email.includes('@')) {
                    showStatus('❌ Please enter a valid email', true);
                    return;
                }
                if (!password || password.length < 6) {
                    showStatus('❌ Password must be at least 6 characters', true);
                    return;
                }

                showStatus('🔄 Creating account...');
                authSignupBtn.disabled = true;

                chrome.runtime.sendMessage({ 
                    action: 'auth-signup', 
                    email, 
                    password 
                }, async (response) => {
                    authSignupBtn.disabled = false;
                    
                    if (response?.success) {
                        showStatus('✅ Account created! Check email or sign in.');
                        await updateAuthUI();
                    } else {
                        showStatus(`❌ ${response?.error || 'Sign up failed'}`, true);
                    }
                });
            });
        }

        // Sign Out handler
        if (authSignoutBtn) {
            authSignoutBtn.addEventListener('click', async () => {
                showStatus('🔄 Signing out...');
                
                chrome.runtime.sendMessage({ action: 'auth-signout' }, async (response) => {
                    if (response?.success) {
                        showStatus('✅ Signed out');
                        // Clear stored auth data
                        await chrome.storage.local.remove(['supabaseUserId', 'authSession']);
                        updateAuthUI();
                        setTimeout(() => location.reload(), 1000);
                    } else {
                        showStatus(`❌ ${response?.error || 'Sign out failed'}`, true);
                    }
                });
            });
        }
    }

    render() {
        const { isPro, dailyUsage, streak, tier, boostedLimitDate, hasSeenOnboarding } = this.state.state;
        const today = new Date().toDateString();
        const isBoosted = boostedLimitDate === today;

        const badge = this.elements.subscriptionBadge;
        badge.textContent = tier.toUpperCase();
        badge.className = `subscription-badge tier-${tier.toLowerCase()}`;

        this.renderRank(streak);

        // Handle Onboarding State
        if (!hasSeenOnboarding) {
            this.elements.onboardingCard.classList.add('visible');
            this.elements.magicEnhanceBtn.querySelector('span').textContent = 'See how it works';
            this.elements.tryExampleBtn.style.display = 'flex';
            this.elements.usageCard.style.display = 'none';
        } else {
            this.elements.onboardingCard.classList.remove('visible');
            this.elements.tryExampleBtn.style.display = 'none';
            this.elements.usageCard.style.display = (tier === 'Plus' || tier === 'Free') ? 'block' : 'none';
        }

        // Handle Daily Boost Lock State
        if (isBoosted) {
            this.elements.sharePlusBtn.classList.add('locked');
            this.elements.boostTitle.textContent = 'Boost Active';
            this.elements.boostDesc.textContent = 'Unlocked +5';
            this.elements.plusModalDesc.textContent = 'You have already unlocked your daily boost. Come back tomorrow for more!';
            this.elements.shareGrid.style.display = 'none';
            this.elements.boostResetTimer.style.display = 'block';

            const now = new Date();
            const hoursUntilReset = 24 - now.getHours();
            this.elements.boostTimeLeft.textContent = `${hoursUntilReset}h`;
        } else {
            this.elements.sharePlusBtn.classList.remove('locked');
            this.elements.boostTitle.textContent = 'Daily Boost';
            this.elements.boostDesc.textContent = '+5 prompts';
            this.elements.plusModalDesc.textContent = 'Share with your network to get 5 extra prompts for today.';
            this.elements.shareGrid.style.display = 'grid';
            this.elements.boostResetTimer.style.display = 'none';
        }

        if (isPro || tier !== 'Free') {
            this.elements.upgradeBtn.style.display = isPro ? 'none' : 'block';
            this.elements.studentPlusBtn.style.display = (tier === 'Plus' || isPro) ? 'none' : 'flex';
            this.elements.sharePlusBtn.style.display = (tier === 'Plus' || isPro) ? 'none' : 'flex';

            if (tier === 'Plus') {
                const limit = CONFIG.PLUS_DAILY_LIMIT;
                this.elements.usageCount.textContent = `${dailyUsage} / ${limit}`;
                this.elements.usageBar.style.width = `${(dailyUsage / limit) * 100}%`;
            }
        } else {
            const boosted = isBoosted ? 5 : 0;
            const baseLimit = tier === 'Plus' ? CONFIG.PLUS_DAILY_LIMIT : CONFIG.FREE_DAILY_LIMIT;
            const dailyLimit = baseLimit + boosted;

            this.elements.usageCount.textContent = `${dailyUsage} / ${dailyLimit}`;
            this.elements.usageBar.style.width = `${(dailyUsage / dailyLimit) * 100}%`;

            if (dailyUsage >= dailyLimit) {
                this.elements.magicEnhanceBtn.disabled = true;
                this.elements.magicEnhanceBtn.querySelector('span').textContent = 'Limit reached';
            } else if (hasSeenOnboarding) {
                this.elements.magicEnhanceBtn.disabled = false;
                this.elements.magicEnhanceBtn.querySelector('span').textContent = 'Enhance prompt';
            }

            const now = new Date();
            const hoursUntilReset = 24 - now.getHours();
            this.elements.usageReset.textContent = `Resets in ${hoursUntilReset}h`;

            this.updateStreakJourney(streak);
        }

        this.elements.statStreak.textContent = `${streak} days`;
    }

    renderRank(streak) {
        let rank = 'Novice';
        let icon = '✨';

        if (streak >= 60) { rank = 'Grandmaster'; icon = '👑'; }
        else if (streak >= 30) { rank = 'Master'; icon = '💎'; }
        else if (streak >= 14) { rank = 'Expert'; icon = '🔥'; }
        else if (streak >= 7) { rank = 'Scholar'; icon = '📚'; }
        else if (streak >= 3) { rank = 'Explorer'; icon = '🚀'; }

        this.elements.rankName.textContent = rank;
        this.elements.rankIcon.textContent = icon;
    }

    async handleApplyPromo() {
        const code = this.elements.promoInput.value.trim().toUpperCase();
        if (code === 'STUDENT2026') {
            await chrome.storage.local.set({ tier: 'Plus', isPro: false });
            alert('Student Plus activated! Enjoy 20 daily prompts.');
            this.hideModal('student-modal');
            await this.state.load();
            this.render();
        } else {
            alert('Invalid promo code.');
        }
    }

    updateStreakJourney(streak) {
        const journey = this.elements.streakJourney;
        const lineFill = this.elements.streakLineFill;

        journey.querySelectorAll('.streak-day').forEach(d => d.remove());

        const weekProgress = streak % 7;
        const totalWeeks = Math.floor(streak / 7);
        const dayNames = ['M', 'T', 'W', 'T', 'F', 'S', 'S'];

        dayNames.forEach((name, i) => {
            const dayEl = document.createElement('div');
            dayEl.className = 'streak-day';
            dayEl.textContent = name;

            if (i < weekProgress) {
                dayEl.classList.add('completed');
                dayEl.textContent = '✓';
            } else if (i === weekProgress && streak > 0) {
                dayEl.classList.add('active');
            }

            const label = document.createElement('span');
            label.className = 'streak-day-label';
            label.textContent = `Day ${totalWeeks * 7 + i + 1}`;
            dayEl.appendChild(label);
            journey.appendChild(dayEl);
        });

        lineFill.style.width = `${(weekProgress / 6) * 100}%`;
    }

    showModal(id) { document.getElementById(id).classList.add('visible'); }
    hideModal(id) { document.getElementById(id).classList.remove('visible'); }

    async handleViralShare(platform) {
        if (this.state.state.boostedLimitDate === new Date().toDateString()) return;

        const text = encodeURIComponent(CONFIG.SHARE_TEXT);
        const url = encodeURIComponent(CONFIG.SHARE_URL);
        let shareUrl = '';

        switch (platform) {
            case 'twitter':
                shareUrl = `https://twitter.com/intent/tweet?text=${text}&url=${url}`;
                break;
            case 'facebook':
                shareUrl = `https://www.facebook.com/sharer/sharer.php?u=${url}`;
                break;
            case 'instagram':
                await navigator.clipboard.writeText(`${CONFIG.SHARE_TEXT} ${CONFIG.SHARE_URL}`);
                alert('Link copied! Open Instagram to share.');
                break;
            case 'linkedin':
                shareUrl = `https://www.linkedin.com/sharing/share-offsite/?url=${url}`;
                break;
            case 'native':
                await navigator.clipboard.writeText(`${CONFIG.SHARE_TEXT} ${CONFIG.SHARE_URL}`);
                alert('Link copied to clipboard!');
                break;
        }

        if (shareUrl) chrome.tabs.create({ url: shareUrl });
        this.grantBoost();
    }

    grantBoost() {
        chrome.runtime.sendMessage({ action: 'grant-share-boost' }, (response) => {
            if (response?.success) {
                this.state.load().then(() => this.render());
            }
        });
    }

    async runOnboardingAnimation() {
        if (this.isAnimating) return;
        this.isAnimating = true;

        const { animTyping, animSparkle, animEnhanced, animStatus, animPulse, magicEnhanceBtn } = this.elements;

        // Reset state
        animTyping.textContent = '';
        animTyping.style.display = 'inline';
        animEnhanced.classList.remove('visible');
        animSparkle.classList.remove('active');
        animStatus.classList.remove('visible');
        animPulse.classList.remove('active');
        magicEnhanceBtn.disabled = true;

        // 1. Typing messy prompt (Cinematic speed)
        const text = "write email to my teacher";
        for (let i = 0; i <= text.length; i++) {
            animTyping.textContent = text.slice(0, i);
            await new Promise(r => setTimeout(r, 70));
        }

        // 2. Pause for tension
        await new Promise(r => setTimeout(r, 800));

        // 3. Neural Pulse Sweep
        animPulse.classList.add('active');
        await new Promise(r => setTimeout(r, 400));

        // 4. Neural Burst (Sparkle)
        animSparkle.classList.add('active');

        // 5. Transform (Instant Resolve)
        await new Promise(r => setTimeout(r, 200));
        animTyping.style.display = 'none';
        animEnhanced.classList.add('visible');

        // 6. Success Status
        await new Promise(r => setTimeout(r, 400));
        animStatus.classList.add('visible');

        // 7. Switch CTA with cinematic delay
        await new Promise(r => setTimeout(r, 2500));
        magicEnhanceBtn.disabled = false;
        magicEnhanceBtn.querySelector('span').textContent = 'Enhance your first prompt →';

        await chrome.storage.local.set({ hasSeenOnboarding: true });
        this.state.state.hasSeenOnboarding = true;
        this.isAnimating = false;
    }

    async handleEnhance() {
        const btn = this.elements.magicEnhanceBtn;
        btn.disabled = true;
        const original = btn.innerHTML;
        btn.innerHTML = `<span>Enhancing...</span>`;

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab) throw new Error('No active tab');
            
            // Check if this is a supported page
            const supportedDomains = ['chatgpt.com', 'openai.com', 'gemini.google.com', 'aistudio.google.com', 'claude.ai', 'perplexity.ai', 'copilot.microsoft.com'];
            const tabUrl = new URL(tab.url || '');
            const isSupported = supportedDomains.some(d => tabUrl.hostname.includes(d));
            
            if (!isSupported) {
                throw new Error('unsupported');
            }

            const response = await chrome.tabs.sendMessage(tab.id, { action: 'trigger-enhance' });
            if (response?.success) {
                await this.state.load();
                this.render();
                setTimeout(() => window.close(), 600);
            } else if (response?.error) {
                alert(response.error);
            }
        } catch (err) {
            if (err.message === 'unsupported') {
                alert('Please open an AI tool (ChatGPT, Gemini, Claude, etc.) to use this feature.');
            } else {
                alert('Could not connect to the page. Try refreshing the page first.');
            }
        } finally {
            btn.disabled = false;
            btn.innerHTML = original;
        }
    }

    startSubscriptionPolling() {
        let attempts = 0;
        const maxAttempts = 12; // Poll for 2 minutes (12 * 10 seconds)
        
        const pollInterval = setInterval(async () => {
            attempts++;
            console.log(`🔄 Polling for subscription update (attempt ${attempts}/${maxAttempts})`);
            
            // Trigger sync in background
            chrome.runtime.sendMessage({ action: 'sync-subscription' }, async (response) => {
                if (response?.success) {
                    // Reload state and check if Pro is now active
                    await this.state.load();
                    
                    if (this.state.state.isPro) {
                        console.log('✅ Pro subscription detected!');
                        clearInterval(pollInterval);
                        this.render();
                        // Show success notification
                        alert('🎉 Pro subscription activated! You now have unlimited access.');
                    }
                }
            });
            
            // Stop polling after max attempts
            if (attempts >= maxAttempts) {
                console.log('⏱️ Subscription polling timed out');
                clearInterval(pollInterval);
            }
        }, 10000); // Poll every 10 seconds
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const stateManager = new StateManager();
    await stateManager.load();
    const ui = new UIController(stateManager);
    ui.init();

    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            stateManager.load().then(() => ui.render());
        }
    });
});
