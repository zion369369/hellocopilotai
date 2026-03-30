# Hello Prompt: Compliance & Security Guide

This document ensures that the Hello Prompt Chrome Extension adheres to the highest standards of privacy, security, and Chrome Web Store policy.

## 1. Permission Justification (Principle of Least Privilege)

| Permission | Reason | User Benefit |
|------------|--------|--------------|
| `activeTab` | Required to interact with the current page's DOM. | Allows the extension to detect text inputs and provide enhancements. |
| `storage` | Required to save user preferences and usage counts. | Ensures a personalized and consistent experience. |
| `host_permissions` | Required to communicate with Gemini API and Supabase. | Powers the intelligence and ASO pipeline. |

## 2. Data Usage & Privacy (Chrome Policy Compliance)

- **No Persistence**: User text inputs are processed in-memory and sent to the Gemini API via a secure HTTPS connection. They are NEVER stored on our servers or in local storage.
- **Explicit Action**: Enhancements only occur when the user clicks the "Enhance" button. There is no background "scraping" of user content.
- **Intent Preservation**: The system is designed to augment, not replace. The user always sees the original text alongside suggestions.

## 3. Security Architecture

- **Shadow DOM**: All UI elements are injected into a closed Shadow DOM to prevent style leakage and protect the extension's UI from being tampered with by the host page.
- **Content Security Policy (CSP)**: The extension follows the default Manifest V3 CSP, which prohibits the execution of remote scripts.
- **Deterministic Logic**: Gemini is configured with a low temperature (0.2) to ensure predictable and stable behavior.

## 4. Chrome Web Store Policy Alignment

- **No Deceptive Claims**: We do not use "spammy" titles or misleading descriptions.
- **Single Purpose**: The extension has a clear, single purpose: augmenting AI prompts.
- **User Data Policy**: We comply with the "Limited Use" requirement by only using user data to provide the core functionality of the extension.

## 5. Fallback & Reliability

- **Graceful Failure**: If the Gemini API is unavailable, the extension displays a clear error message and allows the user to continue with their original text.
- **Network Stability**: All API calls have a 10-second timeout to prevent the UI from hanging on poor connections.

---
*Last Updated: 2026-01-19*
