// content.js — HelloWeb Unified Co-Pilot FAB
// One button. Real-time buddy. Context-aware. Powered by Gemini.

(() => {
  if (window.__HELLOWEB_FAB_LOADED) return;
  // FORCE TOP FRAME ONLY: We ignore ad iframes, DoubleClick placeholders, etc.
  if (window !== window.top) return;
  window.__HELLOWEB_FAB_LOADED = true;

  const GEMINI_SPARKLE_SVG = `
  <svg viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
    <circle cx="14" cy="14" r="14" fill="url(#hw_circle_grad)"/>
    <path d="M14 6L15.8 11.5L21.5 13.3L15.8 15.1L14 20.6L12.2 15.1L6.5 13.3L12.2 11.5L14 6Z" fill="white"/>
    <defs>
      <linearGradient id="hw_circle_grad" x1="0" y1="0" x2="28" y2="28" gradientUnits="userSpaceOnUse">
        <stop stop-color="#4285F4"/> <!-- Google Blue -->
        <stop offset="1" stop-color="#34A853"/> <!-- Google Green -->
      </linearGradient>
    </defs>
  </svg>`;

  // ─────── CREATE SHADOW DOM ROOT ───────
  const root = document.createElement('div');
  root.id = 'helloweb-copilot-root';
  root.style.cssText = `
    all:initial !important; 
    position:fixed !important; 
    top:0; left:0; width:100%; height:100%;
    z-index:2147483647 !important; 
    pointer-events:none !important;
    opacity: 0;
    visibility: hidden;
    transition: opacity 0.4s ease;
  `;
  document.body.appendChild(root);
  const shadow = root.attachShadow({ mode: 'closed' });

  // ─────── INJECT STYLES ───────
  const style = document.createElement('style');
  style.textContent = `
    @import url('https://fonts.googleapis.com/css2?family=Google+Sans:wght@400;500;600;700&display=swap');

    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    /* ═══ THE FAB (FAANG-Grade Dynamic Dot) ═══ */
    .hw-fab {
      position: fixed;
      bottom: 24px;
      right: 24px;
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: url('${chrome.runtime.getURL('icons/icon48.png')}') center/cover no-repeat;
      box-shadow: 0 4px 12px rgba(0,0,0,0.1), 0 0 0 0px rgba(0,0,0,0.05);
      cursor: pointer;
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
      z-index: 10000;
      animation: hw-dot-breathe 4s ease-in-out infinite;
    }

    .hw-fab:hover {
      transform: scale(1.12);
      box-shadow:
        0 8px 32px rgba(0,0,0,0.1),
        0 2px 8px rgba(0,0,0,0.05);
      border-color: rgba(0,0,0,0.1);
    }

    .hw-fab:active {
      transform: scale(0.95);
    }

    .hw-fab.open {
      transform: scale(0.9) rotate(45deg);
      background: url('${chrome.runtime.getURL('icons/icon48.png')}') center/cover no-repeat;
      border-color: rgba(0,0,0,0.1);
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    }

    .hw-fab.open .hw-fab-icon svg path {
      fill: white !important;
    }

    .hw-fab-icon {
      width: 30px;
      height: 30px;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: transform 0.3s ease;
    }

    .hw-fab-icon svg {
      width: 100%;
      height: 100%;
    }

    /* Subtle shadow bloom */
    .hw-fab::before {
      content: '';
      position: absolute;
      inset: -2px;
      border-radius: 50%;
      background: rgba(0,0,0,0.03);
      opacity: 0;
      z-index: -1;
      transition: opacity 0.4s;
    }

    .hw-fab:hover::before {
      opacity: 0.15;
    }

    @keyframes hw-dot-breathe {
      0%, 100% { transform: scale(1); opacity: 0.95; }
      50% { transform: scale(1.1); opacity: 1; }
    }

    /* ═══ CHAT BUBBLE (Nano-Pill) ═══ */
    .hw-chat-bubble {
      position: fixed;
      bottom: 44px; /* Atomic docking */
      right: 24px;
      padding: 2px 8px;
      background: #ffffff;
      border-radius: 100px;
      border: 1px solid #e2e2e2;
      box-shadow: 0 4px 10px rgba(0,0,0,0.05);
      font-family: 'Google Sans', 'Inter', system-ui, sans-serif;
      font-size: 9.5px;
      font-weight: 600;
      color: #1f1f1f;
      cursor: pointer;
      pointer-events: auto;
      max-width: 140px;
      line-height: 1.25;
      word-wrap: break-word;
      z-index: 10001;
      opacity: 0;
      transform: translateY(2px) scale(0.96);
      transition: opacity 0.4s cubic-bezier(0.19, 1, 0.22, 1), transform 0.4s cubic-bezier(0.19, 1, 0.22, 1);
      display: flex;
      align-items: center;
      gap: 4px;
      transform-origin: bottom right;
    }

    /* Sleeker tail */
    .hw-chat-bubble::after {
      content: '';
      position: absolute;
      bottom: -5px;
      right: 14px;
      width: 0;
      height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #ffffff;
    }

    .hw-chat-bubble.visible {
      opacity: 1;
      transform: translateY(0) scale(1);
    }

    .hw-chat-bubble:hover {
      background: #ffffff;
      border-color: rgba(0,0,0,0.1);
      box-shadow: 0 8px 24px rgba(0,0,0,0.06);
      transform: scale(1.02);
    }

    .hw-chat-bubble-text {
      color: #1f1f1f;
      font-weight: 600;
    }

    .hw-chat-bubble-emoji {
      font-size: 13px;
    }

    /* ═══ POPOVER (Suggestion Panel) ═══ */
    .hw-popover {
      position: fixed;
      bottom: 96px;
      right: 28px;
      width: 320px;
      max-height: 440px;
      background: rgba(255, 255, 255, 0.96);
      backdrop-filter: blur(24px) saturate(180%);
      -webkit-backdrop-filter: blur(24px) saturate(180%);
      border: 1px solid rgba(0, 0, 0, 0.08);
      border-radius: 20px;
      box-shadow:
        0 24px 80px rgba(0,0,0,0.12),
        0 4px 12px rgba(0,0,0,0.04);
      pointer-events: auto;
      display: none;
      flex-direction: column;
      overflow: hidden;
      z-index: 9999;
      font-family: 'Google Sans', 'Inter', system-ui, -apple-system, sans-serif;
      transform-origin: bottom right;
      animation: hw-pop-in 0.35s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards;
    }

    .hw-popover.visible {
      display: flex;
    }

    .hw-popover.closing {
      animation: hw-pop-out 0.2s ease-in forwards;
    }

    @keyframes hw-pop-in {
      from { opacity: 0; transform: scale(0.9) translateY(8px); }
      to   { opacity: 1; transform: scale(1) translateY(0); }
    }

    @keyframes hw-pop-out {
      from { opacity: 1; transform: scale(1) translateY(0); }
      to   { opacity: 0; transform: scale(0.85) translateY(16px); }
    }

    /* ─── Popover Header ─── */
    .hw-pop-header {
      padding: 18px 20px 14px;
      display: flex;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid rgba(0,0,0,0.04);
    }

    .hw-pop-logo-dot {
      width: 16px;
      height: 16px;
      border-radius: 50%;
      background: url('${chrome.runtime.getURL('icons/icon48.png')}') center/cover no-repeat;
      box-shadow: 0 0 4px rgba(0,0,0,0.1);
    }

    .hw-pop-title {
      font-size: 16px;
      font-weight: 600;
      color: #1a1a1a;
      letter-spacing: -0.3px;
    }

    .hw-pop-subtitle {
      font-size: 11px;
      font-weight: 500;
      color: #34A853;
      margin-left: auto;
      background: rgba(52, 168, 83, 0.08);
      padding: 3px 10px;
      border-radius: 100px;
      letter-spacing: 0.3px;
      text-transform: uppercase;
    }

    /* ─── Page Context Banner ─── */
    .hw-context-banner {
      padding: 10px 20px;
      background: linear-gradient(135deg, rgba(66,133,244,0.04) 0%, rgba(155,114,203,0.04) 100%);
      font-size: 12px;
      color: #5f6368;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid rgba(0,0,0,0.03);
    }

    .hw-context-icon {
      width: 14px;
      height: 14px;
      color: #4285F4;
      flex-shrink: 0;
    }

    .hw-context-text {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      font-weight: 500;
    }

    /* ─── Suggestions ─── */
    .hw-suggestions {
      padding: 10px 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 6px;
      overflow-y: auto;
      max-height: 300px;
    }

    .hw-suggestions::-webkit-scrollbar {
      width: 4px;
    }
    .hw-suggestions::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.1);
      border-radius: 4px;
    }

    .hw-suggestion-item {
      display: flex;
      align-items: center;
      gap: 16px;
      padding: 16px 20px;
      border-radius: 0;
      cursor: pointer;
      transition: all 0.2s;
      background: transparent;
      border-bottom: 1px solid #f1f3f4;
    }

    .hw-suggestion-item:last-child {
      border-bottom: none;
    }

    .hw-suggestion-item:hover {
      background: #f8f9fa;
    }

    .hw-suggestion-icon-wrap {
      width: 40px;
      height: 40px;
      background: #f1f3f4;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 22px;
      flex-shrink: 0;
    }

    .hw-suggestion-text {
      font-size: 15px;
      font-weight: 500;
      line-height: 1.4;
      color: #3c4043;
      flex: 1;
    }

    .hw-suggestion-arrow {
      width: 18px;
      height: 18px;
      color: #9aa0a6;
      opacity: 0.6;
      transition: transform 0.2s;
    }

    .hw-suggestion-item:hover .hw-suggestion-arrow {
      transform: translateX(4px);
      color: #4285F4;
      opacity: 1;
    }

    /* ─── Loading State ─── */
    .hw-loading {
      padding: 32px 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 14px;
    }

    .hw-loading-dots {
      display: flex;
      gap: 6px;
    }

    .hw-loading-dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      animation: hw-dot-pulse 1.4s ease-in-out infinite;
    }

    .hw-loading-dot:nth-child(1) { background: #4285F4; animation-delay: 0s; }
    .hw-loading-dot:nth-child(2) { background: #EA4335; animation-delay: 0.2s; }
    .hw-loading-dot:nth-child(3) { background: #FBBC04; animation-delay: 0.4s; }
    .hw-loading-dot:nth-child(4) { background: #34A853; animation-delay: 0.6s; }

    @keyframes hw-dot-pulse {
      0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
      40% { transform: scale(1.2); opacity: 1; }
    }

    .hw-loading-text {
      font-size: 13px;
      color: #5f6368;
      font-weight: 500;
    }

    /* ─── Footer ─── */
    .hw-pop-footer {
      padding: 12px 16px;
      border-top: 1px solid rgba(0,0,0,0.04);
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .hw-open-panel-btn {
      flex: 1;
      background: #0668E1;
      color: white;
      border: none;
      padding: 10px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      transition: all 0.2s;
      font-family: inherit;
      letter-spacing: 0.2px;
    }

    .hw-open-panel-btn:hover {
      filter: brightness(1.1);
      transform: translateY(-1px);
      box-shadow: 0 4px 16px rgba(0,0,0,0.15);
    }

    .hw-open-panel-btn:active {
      transform: translateY(0);
    }

    .hw-open-panel-btn svg {
      width: 16px;
      height: 16px;
    }

    /* ─── Responsive ─── */
    @media (max-width: 420px) {
      .hw-popover {
        right: 12px;
        left: 12px;
        width: auto;
        bottom: 88px;
      }
      .hw-fab {
        bottom: 20px;
        right: 20px;
        width: 50px;
        height: 50px;
      }
    }
  `;
  shadow.appendChild(style);

  // ─────── CREATE FAB ───────
  const fab = document.createElement('div');
  fab.className = 'hw-fab';
  fab.setAttribute('role', 'button');
  fab.setAttribute('aria-label', 'Open Hello-Copilot');
  fab.innerHTML = ``; // Pure radiant dot, no internal icon
  shadow.appendChild(fab);

  // ─────── CREATE POPOVER ───────
  const popover = document.createElement('div');
  popover.className = 'hw-popover';
  shadow.appendChild(popover);

  // ─────── CREATE CHAT BUBBLE ───────
  const bubble = document.createElement('div');
  bubble.className = 'hw-chat-bubble';
  bubble.innerHTML = `
    <span class="hw-chat-bubble-emoji">✨</span>
    <span class="hw-chat-bubble-text">Summarize this page?</span>
  `;
  shadow.appendChild(bubble);

  let isOpen = false;
  let currentSuggestions = [];
  let suggestionIndex = 0;
  let rotationInterval = null;

  let isDragging = false;
  let dragX, dragY;
  let startX, startY;
  const DRAG_THRESHOLD = 5;

  // ─────── RESTORE POSITION ───────
  chrome.storage.local.get(['fab_pos'], (res) => {
    if (res.fab_pos) {
      const { right, bottom } = res.fab_pos;
      fab.style.right = right;
      fab.style.bottom = bottom;
      updateRelativePositions(right, bottom);
    } else {
      // PROACTIVELY Detect Collisions on load (for Zendesk, Intercom, etc.)
      setTimeout(detectCollision, 2500);
    }
  });

  function detectCollision() {
    if (isOpen || isDragging) return;

    // Test the hit area at 24px, 24px (standard 16px dot location)
    const testPointX = window.innerWidth - 32;
    const testPointY = window.innerHeight - 32;
    const hitElement = document.elementFromPoint(testPointX, testPointY);

    if (hitElement && hitElement !== document.body && hitElement !== document.documentElement) {
      // We have an overlap! (Usually a Chat Widget or Help Button)
      console.log("[Hello-Copilot] Intelligent Rebalance: Shifting left to avoid collision.");
      const bufferedRight = '96px';
      const standardBottom = '24px';
      fab.style.right = bufferedRight;
      fab.style.bottom = standardBottom;
      updateRelativePositions(bufferedRight, standardBottom);
    }
  }

  function updateRelativePositions(right, bottom) {
    const bInt = parseInt(bottom);
    popover.style.bottom = (bInt + 72) + 'px';
    popover.style.right = right;
    bubble.style.bottom = (bInt + 20) + 'px';
    bubble.style.right = right;
  }

  // ─────── FAB DRAG & CLICK HANDLERS ───────
  fab.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    dragX = parseInt(window.getComputedStyle(fab).right);
    dragY = parseInt(window.getComputedStyle(fab).bottom);

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  });

  function onMouseMove(e) {
    const dx = startX - e.clientX; // Swapped for right alignment
    const dy = startY - e.clientY;

    if (Math.abs(dx) > DRAG_THRESHOLD || Math.abs(dy) > DRAG_THRESHOLD) {
      isDragging = true;
    }

    if (isDragging) {
      const newRight = (dragX + dx) + 'px';
      const newBottom = (dragY + dy) + 'px';
      fab.style.right = newRight;
      fab.style.bottom = newBottom;
      updateRelativePositions(newRight, newBottom);
    }
  }

  function onMouseUp() {
    document.removeEventListener('mousemove', onMouseMove);
    document.removeEventListener('mouseup', onMouseUp);

    if (isDragging) {
      const pos = {
        right: window.getComputedStyle(fab).right,
        bottom: window.getComputedStyle(fab).bottom
      };
      chrome.storage.local.set({ fab_pos: pos });
      setTimeout(() => isDragging = false, 10);
    } else {
      isDragging = false;
    }
  }

  fab.addEventListener('click', (e) => {
    if (isDragging) return;
    e.stopPropagation();
    if (isOpen) closePopover();
    else openPopover();
  });

  // Bubble Click Handler (Immediate Side Panel)
  bubble.addEventListener('click', (e) => {
    e.stopPropagation();
    const activeText = bubble.querySelector('.hw-chat-bubble-text').textContent;
    openSidePanelWithSuggestion(activeText);
  });

  // Close on outside click
  document.addEventListener('click', () => {
    if (isOpen) closePopover();
  });

  function openPopover() {
    isOpen = true;
    fab.classList.add('open');
    bubble.classList.remove('visible'); // HIDE bubble instantly when menu opens
    popover.classList.remove('closing');
    popover.classList.add('visible');
    loadSuggestions();
  }

  function closePopover() {
    isOpen = false;
    fab.classList.remove('open');
    popover.classList.add('closing');
    setTimeout(() => {
      popover.classList.remove('visible', 'closing');
      // Gracefully show bubble back after a small delay
      if (!isOpen) {
        updateBubble();
        bubble.classList.add('visible');
      }
    }, 200);
  }

  // ─────── RENDER POPOVER ───────
  function renderPopover(pageTitle, suggestions, loading = false) {
    const truncatedTitle = (pageTitle || 'Current Page').length > 40
      ? (pageTitle || 'Current Page').substring(0, 40) + '…'
      : (pageTitle || 'Current Page');

    popover.innerHTML = `
      <div class="hw-pop-header">
        <div class="hw-pop-logo-dot"></div>
        <span class="hw-pop-title">Hello Copilot</span>
        <span class="hw-pop-subtitle">● Live</span>
      </div>
      ${loading ? `
        <div class="hw-loading">
          <div class="hw-loading-dots">
            <div class="hw-loading-dot"></div>
            <div class="hw-loading-dot"></div>
            <div class="hw-loading-dot"></div>
            <div class="hw-loading-dot"></div>
          </div>
          <span class="hw-loading-text">Reading the page…</span>
        </div>
      ` : `
        <div class="hw-suggestions">
          ${suggestions.map((s, i) => `
            <div class="hw-suggestion-item" data-index="${i}">
              <div class="hw-suggestion-icon-wrap">
                <span class="hw-suggestion-emoji">${s.emoji}</span>
              </div>
              <span class="hw-suggestion-text">${s.label}</span>
              <svg class="hw-suggestion-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                <polyline points="9 18 15 12 9 6"></polyline>
              </svg>
            </div>
          `).join('')}
        </div>
      `}
      <div class="hw-pop-footer">
        <button class="hw-open-panel-btn" id="hw-open-full">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
          </svg>
          Open Sidebar
        </button>
      </div>
    `;

    // Attach suggestion click handlers
    if (!loading) {
      popover.querySelectorAll('.hw-suggestion-item').forEach(item => {
        item.addEventListener('click', (e) => {
          e.stopPropagation();
          const idx = parseInt(item.dataset.index);
          const suggestion = suggestions[idx];
          if (suggestion) {
            openSidePanelWithSuggestion(suggestion.label);
          }
        });
      });
    }

    // Attach "Open full" button
    const openBtn = popover.querySelector('#hw-open-full');
    if (openBtn) {
      openBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openSidePanel();
      });
    }
  }

  // ─────── LOAD CONTEXTUAL SUGGESTIONS ───────
  async function loadSuggestions() {
    // We keep background suggestions for rotation
    const hostname = window.location.hostname;
    const title = document.title;

    // Initial UI state
    renderPopover(title, [], true);

    try {
      // Get page context
      const pageText = document.body.innerText.substring(0, 6000);

      // Platform-specific smart defaults
      const platformSuggestions = getPlatformSuggestions(hostname, title);
      if (platformSuggestions) {
        currentSuggestions = platformSuggestions;
        startRotation();
        renderPopover(title, currentSuggestions);
        // Also try AI-generated ones in background
        fetchAISuggestions(hostname, title, pageText);
        return;
      }

      // Generic smart defaults while AI loads
      currentSuggestions = getSmartDefaults(title);
      startRotation();
      renderPopover(title, currentSuggestions);

      // Fetch AI-powered suggestions
      fetchAISuggestions(hostname, title, pageText);

    } catch (err) {
      console.warn('[HelloWeb] Failed to load suggestions:', err);
      currentSuggestions = getSmartDefaults(document.title);
      startRotation();
      renderPopover(document.title, currentSuggestions);
    }
  }

  function startRotation() {
    if (rotationInterval) clearInterval(rotationInterval);

    suggestionIndex = 0;
    updateBubble();

    // Show bubble with a slight delay
    setTimeout(() => bubble.classList.add('visible'), 500);

    rotationInterval = setInterval(() => {
      if (isOpen) return; // Don't rotate while popover is open

      bubble.classList.remove('visible');
      setTimeout(() => {
        suggestionIndex = (suggestionIndex + 1) % currentSuggestions.length;
        updateBubble();
        bubble.classList.add('visible');
      }, 600);
    }, 20000); // 20s rotation interval
  }

  function updateBubble() {
    if (!currentSuggestions[suggestionIndex]) return;
    const s = currentSuggestions[suggestionIndex];
    bubble.innerHTML = ''; // Clear
    const emojiSpan = document.createElement('span');
    emojiSpan.className = 'hw-chat-bubble-emoji';
    emojiSpan.textContent = s.emoji || '✨';
    const textSpan = document.createElement('span');
    textSpan.className = 'hw-chat-bubble-text';
    textSpan.textContent = s.label || 'How can I help?';
    bubble.appendChild(emojiSpan);
    bubble.appendChild(textSpan);
  }

  function getPlatformSuggestions(hostname, title) {
    const platforms = {
      'mail.google.com': [
        { emoji: '📋', label: 'Summarize this email thread' },
        { emoji: '💡', label: 'Explain the context here' },
        { emoji: '✅', label: 'Extract key information' },
        { emoji: '🔍', label: 'Find important dates' },
        { emoji: '📝', label: 'Key points from this mail' }
      ],
      'youtube.com': [
        { emoji: '📝', label: 'Summarize this video' },
        { emoji: '⏱️', label: 'Get key timestamps' },
        { emoji: '💡', label: 'Explain the main concept' },
        { emoji: '📚', label: 'Main resources mentioned' },
        { emoji: '❓', label: 'Ask about this content' }
      ],
      'github.com': [
        { emoji: '📖', label: 'Explain this repository' },
        { emoji: '🐛', label: 'Potential issues found' },
        { emoji: '📝', label: 'Summarize recent changes' },
        { emoji: '💡', label: 'Explain this logic' },
        { emoji: '📋', label: 'Project overview' }
      ],
      'linkedin.com': [
        { emoji: '👤', label: 'Summarize this profile' },
        { emoji: '🤝', label: 'Analyze this career path' },
        { emoji: '💬', label: 'Main points of this post' },
        { emoji: '📊', label: 'Engagement summary' },
        { emoji: '🎯', label: 'Key opportunities here' }
      ],
      'web.whatsapp.com': [
        { emoji: '📋', label: 'Summarize recent chat' },
        { emoji: '💡', label: 'Explain the discussion' },
        { emoji: '📅', label: 'Find dates and plans' },
        { emoji: '🔗', label: 'Shared links list' },
        { emoji: '💬', label: 'Tone analysis' }
      ],
      'docs.google.com': [
        { emoji: '📋', label: 'Summarize this document' },
        { emoji: '✏️', label: 'Analyze the writing style' },
        { emoji: '🔍', label: 'Find inconsistencies' },
        { emoji: '📝', label: 'Document outline' },
        { emoji: '🗂️', label: 'Main sections summary' }
      ],
      'facebook.com': [
        { emoji: '📋', label: 'Summarize this post' },
        { emoji: '💡', label: 'What is this about?' },
        { emoji: '👤', label: 'Summarize this profile' },
        { emoji: '📰', label: 'Key news points' },
        { emoji: '📝', label: 'Explain the comments' }
      ],
      'twitter.com': [
        { emoji: '📋', label: 'Summarize this thread' },
        { emoji: '💡', label: 'Explain the controversy' },
        { emoji: '📊', label: 'Analyze the reach' },
        { emoji: '🔥', label: 'Trending topics context' },
        { emoji: '💬', label: 'Main takes summary' }
      ],
      'x.com': [
        { emoji: '📋', label: 'Summarize this thread' },
        { emoji: '💡', label: 'Explain the discussion' },
        { emoji: '📊', label: 'Post impact analysis' },
        { emoji: '🔥', label: 'Related trends' },
        { emoji: '💬', label: 'Opinion summary' }
      ],
      'reddit.com': [
        { emoji: '📋', label: 'Summarize this thread' },
        { emoji: '🔍', label: 'Find the consensus' },
        { emoji: '📊', label: 'Analyze the debate' },
        { emoji: '📝', label: 'Summarize top comments' },
        { emoji: '💡', label: 'Explain the context' }
      ],
      'amazon.': [
        { emoji: '📋', label: 'Summarize product reviews' },
        { emoji: '⭐', label: 'Pros and cons list' },
        { emoji: '🔍', label: 'Key specifications' },
        { emoji: '💰', label: 'Value analysis' },
        { emoji: '📝', label: 'Product details summary' }
      ],
      'instagram.com': [
        { emoji: '📋', label: 'Summarize this profile' },
        { emoji: '💡', label: 'Main themes here' },
        { emoji: '📊', label: 'Engagement overview' },
        { emoji: '🏷️', label: 'Content tags summary' },
        { emoji: '✨', label: 'Aesthetic analysis' }
      ],
      'tiktok.com': [
        { emoji: '📋', label: 'Summarize this video' },
        { emoji: '🔥', label: 'Explain the trend' },
        { emoji: '📊', label: 'Content impact' },
        { emoji: '💡', label: 'What\'s happening here?' },
        { emoji: '📝', label: 'Discussion summary' }
      ],
      'notion.so': [
        { emoji: '📋', label: 'Summarize this page' },
        { emoji: '📝', label: 'Extract main outline' },
        { emoji: '🗂️', label: 'Content organization' },
        { emoji: '💡', label: 'Explain key ideas' },
        { emoji: '✨', label: 'Synthesize the notes' }
      ],
      'google.com': [
        { emoji: '🔍', label: 'Analyze search results' },
        { emoji: '📋', label: 'Synthesize the top sites' },
        { emoji: '💡', label: 'Related topics' },
        { emoji: '📝', label: 'Comparison of results' },
        { emoji: '❓', label: 'Help me understand' }
      ],
      'slack.com': [
        { emoji: '📋', label: 'Summarize this conversation' },
        { emoji: '✅', label: 'Key takeaways' },
        { emoji: '📅', label: 'Find decisions made' },
        { emoji: '💬', label: 'Analyze the thread' },
        { emoji: '💡', label: 'Context summary' }
      ]
    };

    for (const [domain, suggestions] of Object.entries(platforms)) {
      if (hostname.includes(domain)) return suggestions;
    }
    return null;
  }

  function getSmartDefaults(title) {
    return [
      { emoji: '📋', label: 'Summarize this page' },
      { emoji: '💡', label: 'Explain the key concepts' },
      { emoji: '❓', label: 'Ask something about this page' },
      { emoji: '📝', label: 'Extract the main points' },
      { emoji: '🔍', label: 'Find specific information' }
    ];
  }

  // ─────── SURGICAL DOM PRUNER (Advanced Cost Engineering) ───────
  function surgicalPruneDOM() {
    // Clone body to avoid mutating the live page
    const clone = document.body.cloneNode(true);

    // 1. Tag Stripping (Remove noise)
    const noiseTags = ['script', 'style', 'svg', 'iframe', 'noscript', 'nav', 'header', 'footer'];
    noiseTags.forEach(tag => {
      clone.querySelectorAll(tag).forEach(el => el.remove());
    });

    // 2. Interactive Focus (Retain semantic intent)
    const interactiveSelectors = 'a, button, input, select, textarea, [role], [onclick], h1, h2, h3, h4';
    const interactiveElements = Array.from(clone.querySelectorAll(interactiveSelectors));

    // 3. Attribute Minimization & Semantic Map
    let prunedText = `URL: ${window.location.href}\nTITLE: ${document.title}\nINTERACTIVE MAP:\n`;

    interactiveElements.slice(0, 50).forEach(el => {
      const tag = el.tagName.toLowerCase();
      const label = el.getAttribute('aria-label') || el.innerText.trim() || el.getAttribute('placeholder') || el.getAttribute('title') || "";
      if (label) {
        prunedText += `[${tag}] ${label.substring(0, 80)}\n`;
      }
    });

    // 4. Main Body Summary (TL;DR prune)
    const bodyText = clone.innerText.trim().replace(/\s+/g, ' ');
    prunedText += `\nBODY SUMMARY:\n${bodyText.substring(0, 2000)}`;

    return prunedText;
  }

  async function fetchAISuggestions(hostname, title, pageText) {
    try {
      // ═══ RE-ROUTE TO BACKGROUND: First Review Best Practice ═══
      const prunedContext = surgicalPruneDOM();

      const response = await chrome.runtime.sendMessage({
        action: 'fetch_ai_suggestions',
        hostname,
        title,
        pageText: prunedContext
      });

      if (response?.success && response?.suggestions && response.suggestions.length > 0) {
        const aiSuggestions = response.suggestions;
        currentSuggestions = aiSuggestions.slice(0, 5);
        if (isOpen) renderPopover(title, currentSuggestions);
        // Show bubble only when we have high-confidence suggestions
        bubble.classList.add('visible');
        if (!rotationInterval) startRotation();
      } else {
        // HIDE bubble if no high-value suggestions (80% confidence rule)
        bubble.classList.remove('visible');
        if (rotationInterval) {
          clearInterval(rotationInterval);
          rotationInterval = null;
        }
      }
    } catch (err) {
      console.warn('[HelloWeb] AI suggestions relay failed:', err);
    }
  }

  // ─────── SIDE PANEL INTERACTION ───────
  function openSidePanel() {
    closePopover();
    // Open side panel via the action click
    chrome.runtime.sendMessage({ action: 'open_sidepanel' });
  }

  async function openSidePanelWithSuggestion(text) {
    if (!text) return;
    closePopover();

    // Store for immediate pick-up by sidepanel (for 'immediate answer' feel)
    await chrome.storage.local.set({
      pendingPrompt: {
        text: text,
        timestamp: Date.now()
      }
    });

    // Also send message in case it's ALREADY open
    chrome.runtime.sendMessage({
      action: 'sidepanel_ghost_focus',
      type: 'suggestion',
      content: text,
      url: window.location.href,
      title: document.title
    });

    // Also open the side panel
    chrome.runtime.sendMessage({ action: 'open_sidepanel' });
  }

  // ─────── MESSAGE BRIDGE — RICH DOM EXTRACTION ───────
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'extract_dom') {
      sendResponse(extractRichDOM());
      return true;
    }
    if (request.action === 'sync_suggestions') {
      const freshSuggestions = (request.suggestions || []).map(s => ({
        emoji: '✨',
        label: typeof s === 'string' ? s : (s.label || s)
      }));
      if (freshSuggestions.length > 0) {
        currentSuggestions = freshSuggestions;
        suggestionIndex = 0;
        updateBubble();
        bubble.classList.add('visible');
        if (!rotationInterval) startRotation();
      }
      sendResponse({ success: true });
      return true;
    }
    if (request.action === 'inject_text') {
      injectTextToPage(request.text);
      sendResponse({ success: true });
      return true;
    }
  });

  /**
   * Rich DOM Extraction — captures structured page data
   * instead of just raw innerText
   */
  function extractRichDOM() {
    try {
      const url = window.location.href;
      const hostname = window.location.hostname;
      const title = document.title;

      // ─── Meta tags ───
      const metaDesc = document.querySelector('meta[name="description"]')?.content || '';
      const ogTitle = document.querySelector('meta[property="og:title"]')?.content || '';
      const ogDesc = document.querySelector('meta[property="og:description"]')?.content || '';
      const ogSiteName = document.querySelector('meta[property="og:site_name"]')?.content || '';
      const ogType = document.querySelector('meta[property="og:type"]')?.content || '';
      const keywords = document.querySelector('meta[name="keywords"]')?.content || '';

      // ─── Headings (structure) ───
      const headings = [];
      document.querySelectorAll('h1, h2, h3').forEach((h, i) => {
        if (i < 20 && h.innerText.trim()) {
          headings.push(`[${h.tagName}] ${h.innerText.trim().substring(0, 120)}`);
        }
      });

      // ─── Selected text (if any) ───
      const selection = window.getSelection()?.toString()?.trim() || '';

      // ─── Main content extraction (Clean and surgical) ───
      function getCleanText(root = document.body) {
        // Clone and clean up
        const clone = root.cloneNode(true);
        // SURGERY: Aggressively ignore sidebars, navbars, and common noise containers
        const toRemove = clone.querySelectorAll(`
          script, style, link, noscript, iframe, svg, canvas, .hidden, [aria-hidden="true"],
          nav, aside, [role="navigation"], [role="complementary"],
          header, footer, #header, #footer, .sidebar, .nav, .menu,
          #pane-side, [aria-label="Chat list"] /* WhatsApp specific */
        `);
        toRemove.forEach(el => el.remove());

        /**
         * Privacy Engine (v5.0.2 Blueprint) 
         * Localized PII Scrubbing before data egress
         */
        function scrubPII(text) {
          return text
            // Emails
            .replace(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g, '[EMAIL-REDACTED]')
            // Credit Card Patterns (Luhn-agnostic basic match)
            .replace(/\b(?:\d[ -]*?){13,16}\b/g, '[CARD-REDACTED]')
            // Generic Phone Patterns
            .replace(/(?:\+\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g, '[PHONE-REDACTED]');
        }

        // Return sanitized text
        const rawText = clone.innerText.replace(/\n\s*\n/g, '\n').trim();
        return scrubPII(rawText);
      }

      let mainContent = '';
      const mainEl = document.querySelector('main, article, [role="main"], #content, .content');
      if (mainEl && mainEl.innerText.trim().length > 100) {
        mainContent = getCleanText(mainEl);
      } else {
        mainContent = getCleanText(document.body);
      }

      // ─── Links on page ───
      const links = [];
      document.querySelectorAll('a[href]').forEach((a, i) => {
        if (i < 15 && a.innerText.trim() && a.href && !a.href.startsWith('javascript:')) {
          links.push(a.innerText.trim().substring(0, 80));
        }
      });

      // ─── Platform-specific extraction ───
      let platformData = '';

      // Facebook surgical feed extraction (Omniscient Mode)
      if (hostname.includes('facebook.com') || hostname.includes('fb.com')) {
        const posts = [];
        const articleEls = document.querySelectorAll('[role="article"]');
        articleEls.forEach((art, i) => {
          if (i < 8) {
            // Use TreeWalker to find ALL visible text nodes that are user-authored
            const walker = document.createTreeWalker(art, NodeFilter.SHOW_TEXT, {
              acceptNode: (node) => {
                const p = node.parentElement;
                if (!p) return NodeFilter.FILTER_REJECT;
                // Exclude technical metadata and hidden elements
                const isBad = p.closest('script, style, link, noscript, [aria-hidden="true"], .x1i10hfl');
                return isBad ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT;
              }
            });
            let artText = "";
            let node;
            while (node = walker.nextNode()) {
              const t = node.textContent.trim();
              if (t.length > 2) artText += t + " ";
            }
            // Filter out FB-specific UI boilerplate fragments
            const sanitized = artText.replace(/Like|Comment|Share|Send|Reply|·|Just now|\d+[smhwd]|Suggested for you|Sponsored|See more/g, '').replace(/\s+/g, ' ').trim();
            if (sanitized.length > 50) posts.push(`[FB POST ${i + 1}]:\n${sanitized.substring(0, 1500)}`);
          }
        });
        if (posts.length > 0) platformData = `\n--- DETECTED USER POSTS ---\n${posts.join('\n---\n')}`;
      }

      // WhatsApp-specific (Surgical Chat Extraction)
      if (hostname.includes('web.whatsapp.com')) {
        const messages = [];
        // Target message rows and bubbles
        document.querySelectorAll('div.message-in, div.message-out').forEach((msg, i) => {
          if (i < 20) {
            const isMe = msg.classList.contains('message-out');
            const textEl = msg.querySelector('.copyable-text, .selectable-text, span[dir="ltr"]');
            let text = textEl ? textEl.innerText.trim() : msg.innerText.trim();
            // Clean up appended timestamp/status noise if it's there
            text = text.replace(/\d{1,2}:\d{2}\s?(?:AM|PM|am|pm)?$/i, '').trim();
            if (text.length > 1) messages.push(`[${isMe ? 'ME' : 'THEY'}]: ${text.substring(0, 1000)}`);
          }
        });
        if (messages.length > 0) platformData = `\n--- ACTIVE WHATSAPP CHAT HISTORY ---\n${messages.join('\n')}`;
      }

      // Twitter/X-specific
      if (hostname.includes('twitter.com') || hostname.includes('x.com')) {
        const tweets = [];
        document.querySelectorAll('[data-testid="tweetText"], article [lang]').forEach((t, i) => {
          if (i < 8 && t.innerText.trim()) {
            tweets.push(t.innerText.trim().substring(0, 400));
          }
        });
        platformData = `\n[TWEETS/POSTS]:\n${tweets.join('\n---\n')}`;
      }

      // Reddit-specific
      if (hostname.includes('reddit.com')) {
        const comments = [];
        document.querySelectorAll('[id^="t1_"], .Comment, shreddit-comment, [slot="comment"]').forEach((c, i) => {
          if (i < 8 && c.innerText.trim()) {
            comments.push(c.innerText.trim().substring(0, 400));
          }
        });
        platformData = `\n[REDDIT COMMENTS]:\n${comments.join('\n---\n')}`;
      }

      // YouTube-specific
      if (hostname.includes('youtube.com')) {
        const videoTitle = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata, #title h1')?.innerText || '';
        const channel = document.querySelector('#channel-name a, ytd-channel-name a')?.innerText || '';
        const description = document.querySelector('#description-text, #description .content, ytd-text-inline-expander')?.innerText?.substring(0, 1000) || '';
        platformData = `\n[VIDEO] Title: ${videoTitle}\nChannel: ${channel}\nDescription: ${description}`;
      }

      // Build structured markdown (Omnipotent formatting)
      const structured = `
═══════════════════════════════════════
  PAGE INTEL: ${ogSiteName || hostname}
═══════════════════════════════════════

═══ TOP LEVEL METADATA ═══
TITLE: ${ogTitle || title}
DESCRIPTION: ${metaDesc || ogDesc}
TYPE: ${ogType || 'General'}
URL: ${url}

═══ CRITICAL USER CONTENT ═══
${platformData || "Standard informational page."}

${selection ? `\n═══ USER HIGHLIGHTED TEXT ═══\n${selection}\n` : ''}

═══ DETAILED PAGE BODY (CLEANED) ═══
${mainContent.substring(0, 18000)}
`.trim();

      return {
        success: true,
        markdown: structured,
        url: url,
        title: title,
        hostname: hostname,
        meta: { ogTitle, ogDesc, ogSiteName, ogType, metaDesc, keywords },
        headings: headings.slice(0, 10),
        selection: selection.substring(0, 2000),
        links: links
      };
    } catch (err) {
      console.warn('[HelloWeb] DOM extraction error:', err);
      return {
        success: true,
        markdown: document.body.innerText.substring(0, 20000),
        url: window.location.href,
        title: document.title
      };
    }
  }

  function injectTextToPage(text) {
    const el = document.activeElement;
    if (!el) return;

    const isEditable = el.isContentEditable || el.tagName === 'TEXTAREA' || el.tagName === 'INPUT';
    if (!isEditable) return;

    el.focus();
    try {
      if (document.execCommand('insertText', false, text)) return;
    } catch (e) { }

    if (el.isContentEditable) {
      el.innerHTML = text.split('\n').map(l => l.trim() === '' ? '<div><br></div>' : `<div>${l}</div>`).join('');
    } else {
      el.value = text;
    }
    ['input', 'change'].forEach(ev => el.dispatchEvent(new Event(ev, { bubbles: true })));
  }

  // ─────── DETERMINISTIC ID INJECTION & MULTI-LAYER BRIDGE ───────
  try {
      if (window.location.href.includes("localhost:3000") || window.location.href.includes("hellocopilot")) {
          document.documentElement.setAttribute('data-hello-copilot-id', chrome.runtime.id);
      }
  } catch(e) {}

  window.addEventListener("message", (event) => {
    if (event.data && event.data.source === "HELLO_COPILOT_DASHBOARD") {
      const { type, actionId, payload } = event.data;
      
      if (type === "HELLOCO_CAPTURE_SCREENSHOT") {
         try {
             chrome.runtime.sendMessage({ action: "capture_screenshot" }, (res) => {
                 let finalRes = res;
                 if (chrome.runtime.lastError) finalRes = { success: false, error: chrome.runtime.lastError.message };
                 window.postMessage({ source: "HELLO_COPILOT_CONTENT_RELAY", actionId, response: finalRes || {success: false, error: "Empty Extension Response"} }, "*");
             });
         } catch (e) {
             window.postMessage({ source: "HELLO_COPILOT_CONTENT_RELAY", actionId, response: { success: false, error: e.message } }, "*");
         }
      }

      if (type === "HELLOCO_EXEC_ACTION") {
         try {
             chrome.runtime.sendMessage({ action: "execute_computer_action", name: payload.name, args: payload.args }, (res) => {
                 let finalRes = res;
                 if (chrome.runtime.lastError) finalRes = { success: false, error: chrome.runtime.lastError.message };
                 window.postMessage({ source: "HELLO_COPILOT_CONTENT_RELAY", actionId, response: finalRes || {success: false, error: "Empty Extension Response"} }, "*");
             });
         } catch (e) {
             window.postMessage({ source: "HELLO_COPILOT_CONTENT_RELAY", actionId, response: { success: false, error: e.message } }, "*");
         }
      }
    }
  });

  // ─────── Initial Load ───────
  loadSuggestions();

  // ─────── Auto-refresh suggestions on navigation ───────
  let lastUrl = window.location.href;
  const urlObserver = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      if (isOpen) loadSuggestions();
    }
  });
  urlObserver.observe(document.body, { childList: true, subtree: true });

  // ─────── Smooth Reveal (Prevents 'Broken Arc' glitch) ───────
  setTimeout(() => {
    root.style.opacity = '1';
    root.style.visibility = 'visible';
  }, 100);

})();
