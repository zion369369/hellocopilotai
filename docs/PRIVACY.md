# Privacy Policy: Hello Copilot

**Last Updated**: March 24, 2026

Hello Copilot ("The Extension") is a browser-native AI assistant designed to provide localized, zero-friction analytical support. We prioritize user privacy and data security as foundational architectural pillars.

## 1. Data Collection & Usage
- **Contextual Data**: The Extension processes the content of the active tab (DOM) to generate relevant AI suggestions and responses. This data is transmitted to the **Gemini API** via secure, encrypted channels (HTTPS).
- **No Persistence**: Tab data is processed in real-time and is NOT stored on our servers. It exists only in volatile memory during the generation window.
- **Local Storage**: We utilize `chrome.storage.local` to store your interaction preferences, daily usage counts (for analytics), and episodic memories (last 10 interactions) locally on your device.

## 2. Permissions Justification
- **sidePanel**: To provide a persistent, non-intrusive analytical interface.
- **storage**: To save user preferences and local session history.
- **scripting & <all_urls>**: Required to inject the 'Floating Action Button' (FAB) and extract semantic page context from diverse web environments, ensuring a "Browser-Native" experience.

## 3. Third-Party Services
- **Gemini API**: AI generation is powered by Google's Gemini systems. By using Hello Copilot, users agree to the terms of the Gemini API environment.
- **No Telemetry**: We do not use third-party tracking pixels, ads, or cookies.

## 4. Security
- **XSS Protection**: All AI-generated content is sanitized using **DOMPurify** before being rendered in the sidepanel.
- **Local Vault**: Your episodic memory and preferences never leave your local machine.

## 5. Contact
For any privacy inquiries or to request data clarification, please contact the developer through the Chrome Web Store support channel.

---
*Identity: PRIVATE. Architecture: SECURE. Model: COMPLIANT.*
