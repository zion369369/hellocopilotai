# Hello-Copilot: Strategic Caching & Cost Engineering

This document outlines the advanced caching and cost engineering framework utilized by Hello-Copilot to ensure Faang-grade performance while maintaining fiscal sustainability for 1000+ free users.

## 🧠 Caching Architecture

Hello-Copilot utilizes a hybrid caching model optimized for the **Gemini 2.5 Flash Lite** ecosystem.

### 1. Implicit Caching (Automatic)
Enabled by default for all model interactions. We optimize prompt prefixing to maximize hits.
- **Min Token Threshold**: 1024 tokens (Gemini 2.5 Flash / Flash Lite).
- **Optimization Strategy**: We place large, static page contexts and complex system instructions at the beginning of the prompt.
- **Monitoring**: All responses include `usage_metadata.cached_content_token_count` tracking.

### 2. Explicit Caching (Manual)
Utilized for long-running sessions or massive DOM contexts where cost-saving guarantees are required.
- **Implementation**: Managed via `background.js` through the `v1beta/cachedContents` REST endpoint.
- **TTL Lifecycle**: Standard TTL is set to **1 hour (3600s)**, automatically invalidated upon significant DOM mutations.
- **Handshake Protocol**: The sidepanel performs a "Cache Handshake" before every generation turn. If the context exceeds the 1024-token efficiency barrier, a high-fidelity explicit cache is established.

## 📉 Cost Engineering Metrics (Gemini 2.5 Flash Lite)

| Component | Cost Rate | Performance Impact |
| --- | --- | --- |
| **Input Tokens** | $0.10 / 1M | Prefill optimized |
| **Output Tokens** | $0.40 / 1M | Decode bottleneck (Strictly limited to 5-30 words) |
| **Explicit Caching** | $0.01 / 1M | 75% recurring saving on long contexts |

## 🛠️ Data Pruning (Context Compression)

To maximize the efficiency of both implicit and explicit caching, we utilize a **Surgical DOM Pruner**:
1. **Rule-Based Stripping**: Removes non-semantic tags (`<script>`, `<style>`, `<svg>`).
2. **Interactive Map**: Extracts high-intent nodes (`<button>`, `<a>`, `[role]`) with minimized attributes (ARIA labels, placeholders).
3. **Semantic TL;DR**: Compresses raw body content into a high-density text summary.

## ⚖️ Token Governance

- **Daily Quota**: 500 interaction units per account.
- **Tracking**: Persistent usage metrics stored in `chrome.storage.local`.
- **Enforcement**: Automated fallback to "Quota Exhausted" state to protect infrastructure budget.

---
*Identity: ARCHITECTED. Performance: OPTIMIZED. Cost: MASTERED.*
