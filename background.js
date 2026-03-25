// background.js — hellocopilotai Browser Bridge (Executor Layer)
// This is a "Dumb Bridge" providing screen & execution access to the main LAM Dashboard.
// All cognitive intelligence resides in the web-based Orchestrator.

chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});

let agentTargetTabId = null; 

const getAgentTab = async () => {
  if (agentTargetTabId) {
    try {
      return await chrome.tabs.get(agentTargetTabId);
    } catch (e) { agentTargetTabId = null; }
  }
  // If no target, find an appropriate external tab (not the dashboard)
  const tabs = await chrome.tabs.query({ currentWindow: true });
  const externalTab = tabs.find(t => !t.url.includes("localhost:3000") && !t.url.includes("hellocopilot"));
  if (externalTab) {
      agentTargetTabId = externalTab.id;
      return externalTab;
  }
  return null;
};

const universalMessageHandler = (request, sender, sendResponse) => {

  // ═══ Heartbeat (v=4.1.0) ═══
  if (request.action === 'heartbeat') {
    sendResponse({ success: true, version: "4.1.0", status: "ready" });
    return false;
  }
  if (request.action === 'open_sidepanel') {
    const tabId = sender?.tab?.id;
    if (tabId) chrome.sidePanel.open({ tabId }).catch(() => {});
    sendResponse({ success: true });
    return false;
  }

  // ═══ Capture Screenshot (Target-Aware Grounding) ═══
  if (request.action === 'capture_screenshot') {
    getAgentTab().then(tab => {
        if (!tab) return sendResponse({ success: false, error: "No target tab found." });
        chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' }, (dataUrl) => {
          if (chrome.runtime.lastError) return sendResponse({ success: false, error: chrome.runtime.lastError.message });
          sendResponse({ success: true, data: dataUrl });
        });
    });
    return true;
  }

  // ═══ Execute Action (Physical Actuator) ═══
  if (request.action === 'execute_computer_action') {
    const { name, args } = request;

    // ⟨High-Privileged Actuation⟩: open_web_browser must run in Background context
    if (name === "open_web_browser") {
      chrome.tabs.create({ url: args.url || "about:blank", active: true }).then(newTab => {
        agentTargetTabId = newTab.id;
        sendResponse({ success: true, result: { message: "New tab spawned: " + agentTargetTabId } });
      });
      return true;
    }

    getAgentTab().then(async tab => {
      if (!tab) return sendResponse({ success: false, error: "No target tab." });
      
      try {
        const results = await chrome.scripting.executeScript({
          target: { tabId: tab.id, frameIds: [0] },
          args: [name, args],
          func: (actionName, actionArgs) => {
            const sw = window.innerWidth;
            const sh = window.innerHeight;
            const normX = (v) => Math.floor((Number(v) || 0) / 1000 * sw);
            const normY = (v) => Math.floor((Number(v) || 0) / 1000 * sh);

            const getElementAt = (x, y) => {
              let el = document.elementFromPoint(x, y);
              if (!el) return null;
              while (el.shadowRoot) {
                  const subEl = el.shadowRoot.elementFromPoint(x, y);
                  if (!subEl || subEl === el) break;
                  el = subEl;
              }
              return el;
            };

            const humanClick = (el, x, y) => {
              const opts = { bubbles: true, cancelable: true, view: window, clientX: x, clientY: y };
              el.dispatchEvent(new PointerEvent('pointerdown', opts));
              el.dispatchEvent(new MouseEvent('mousedown', opts));
              el.focus();
              const upOpts = { ...opts, buttons: 0 };
              el.dispatchEvent(new PointerEvent('pointerup', upOpts));
              el.dispatchEvent(new MouseEvent('mouseup', upOpts));
              el.click();
            };

            try {
                if (actionName === "inject_som") {
                   const labels = document.querySelectorAll('button, a, input, [role="button"], [role="link"]');
                   const style = document.createElement('style');
                   style.id = 'hello-copilot-som-style';
                   style.textContent = `.hello-copilot-som-tag { position:absolute; background:rgba(217, 75, 213, 0.85); color:white; font-size:11px; padding:2px 4px; border-radius:4px; z-index:2147483647; pointer-events:none; font-family:Outfit,sans-serif; box-shadow:0 2px 5px rgba(0,0,0,0.2); }`;
                   document.head.appendChild(style);

                   labels.forEach((el, i) => {
                       const rect = el.getBoundingClientRect();
                       if (rect.width < 5 || rect.height < 5 || rect.top < 0 || rect.left < 0) return;
                       const tag = document.createElement('div');
                       tag.className = 'hello-copilot-som-tag';
                       tag.style.left = (rect.left + window.scrollX) + 'px';
                       tag.style.top = (rect.top + window.scrollY) + 'px';
                       tag.textContent = i + 1;
                       document.body.appendChild(tag);
                   });
                   return { success: true };
                }

                if (actionName === "clear_som") {
                   document.querySelectorAll('.hello-copilot-som-tag').forEach(t => t.remove());
                   document.getElementById('hello-copilot-som-style')?.remove();
                   return { success: true };
                }

                if (actionName === "wait_5_seconds") return new Promise(r => setTimeout(() => r({success:true}), 5000));
                
                if (actionName === "click_at") {
                   const x = normX(actionArgs.x); const y = normY(actionArgs.y);
                   const el = getElementAt(x, y);
                   if (el) { humanClick(el, x, y); return { success: true, message: `Clicked (${x},${y})` }; }
                   return { success: false, message: "Target missing." };
                }

                if (actionName === "type_text_at") {
                    const x = normX(actionArgs.x); const y = normY(actionArgs.y);
                    const { text, clear_before_typing = true, press_enter = true } = actionArgs;
                    const el = getElementAt(x, y);
                    if (el) {
                        el.focus(); el.click();
                        if (clear_before_typing) {
                            if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') el.value = '';
                            else if (el.isContentEditable) el.innerText = '';
                        }
                        document.execCommand('insertText', false, text);
                        if (press_enter) el.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
                        return { success: true, message: `Typed at (${x},${y})` };
                    }
                    return { success: false, message: "Target missing." };
                }

                if (actionName === "scroll_document") {
                   const amt = actionArgs.direction === "down" ? 600 : -600;
                   window.scrollBy({ top: amt, behavior: "smooth" });
                   return { success: true };
                }

                if (actionName === "navigate") { 
                    window.location.href = actionArgs.url; 
                    return { success: true }; 
                }
                if (actionName === "go_back") { window.history.back(); return { success: true }; }
                
                return { success: false, message: `Action ${actionName} not handled.` };
            } catch (err) { return { success: false, message: err.message }; }
          }
        });
        sendResponse({ success: true, result: results?.[0]?.result });
      } catch (err) { sendResponse({ success: false, error: err.message }); }
    });
    return true;
  }

  sendResponse({ success: false, error: "Unrecognized action." });
  return false;
};

chrome.runtime.onMessage.addListener(universalMessageHandler);
chrome.runtime.onMessageExternal.addListener(universalMessageHandler);
