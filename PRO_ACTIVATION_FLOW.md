# Hello World GPT Pro - Subscription Activation Flow

## Overview
This document explains how users who pay for Hello World GPT Pro through Stripe automatically receive their Pro benefits in the Chrome extension.

## Payment to Activation Flow

### 1. **User Clicks "Upgrade to Pro"**
- User clicks the upgrade button in the Chrome extension popup
- Opens Stripe payment link: `https://buy.stripe.com/test_7sY8wPaLZ8Ln8iG2n68Ra00`
- $20/month subscription

### 2. **Stripe Payment Processing**
- User completes payment on Stripe checkout page
- Stripe sends `checkout.session.completed` webhook to backend
- Backend webhook handler (`server/routes/stripe.js`) processes the payment

### 3. **Webhook Updates Database**
The `handleCheckoutSessionCompleted` function:
- Retrieves subscription details from Stripe
- Updates `customers` table in Supabase with:
  - `subscription_status`: 'active'
  - `subscription_id`: Stripe subscription ID
  - `plan_id`: Price ID from Stripe
  - `current_period_end`: Subscription end date
  - `supabase_user_id`: User's Supabase ID (if available)

### 4. **Extension Syncs Subscription Status**
The Chrome extension automatically syncs Pro status through multiple mechanisms:

#### A. **Automatic Sync Triggers**
- **On Extension Install/Update**: Checks subscription status immediately
- **On Extension Startup**: Syncs when browser starts
- **Periodic Sync**: Every 5 minutes while extension is running
- **Manual Sync**: Via `sync-subscription` message

#### B. **Sync Process** (`syncSubscriptionStatus` function)
```javascript
1. Reads supabaseUserId from extension storage
2. Queries Supabase customers table
3. Checks if subscription_status === 'active'
4. Updates extension storage with:
   - isPro: true/false
   - proExpiry: subscription end date
   - tier: 'Pro' or 'Free'
   - planId: subscription plan ID
5. Updates in-memory cache
```

### 5. **Pro Benefits Activated**
Once `isPro` is set to `true`, users get:

#### Unlimited Enhancements
- `canEnhance()` returns `{ allowed: true, remaining: Infinity }`
- No daily limit checks
- No circuit breaker restrictions

#### Advanced AI Models
- Access to premium models (Grok, etc.)
- Higher token limits (800 vs 400 output tokens)
- Better quality enhancements

#### Enhanced Features
- Real-time intelligence always enabled
- Priority processing
- Advanced prompt strategies

## User Linking Methods

### Method 1: Automatic (Recommended)
If user is logged into the main Hello World GPT app:
- Stripe webhook finds user by email
- Links subscription to Supabase user ID
- Extension syncs automatically

### Method 2: Manual Linking
For users who pay before logging in:
1. User logs into Hello World GPT app
2. App calls extension message: `link-supabase-user`
3. Extension stores user ID and syncs immediately

### Method 3: Pro Activation Page
After payment, redirect to `/pro-activated.html`:
- Checks Supabase session
- Links extension to user account
- Confirms Pro activation

## Code References

### Backend (Stripe Webhook)
**File**: `server/routes/stripe.js`
- `handleCheckoutSessionCompleted()`: Lines 445-516
- Updates customers table with subscription data
- Links Stripe customer to Supabase user

### Chrome Extension (Background Script)
**File**: `chrome-extension/background.js`

#### Key Functions:
- `syncSubscriptionStatus()`: Lines 630-690
  - Fetches subscription from Supabase
  - Updates extension storage
  - Activates Pro benefits

- `linkSupabaseUser(userId, email)`: Lines 692-703
  - Links extension to user account
  - Triggers immediate sync

- `canEnhance()`: Lines 122-146
  - Checks if user can use enhancement
  - Returns unlimited for Pro users

#### Message Handlers:
- `link-supabase-user`: Link extension to Supabase account
- `sync-subscription`: Manually trigger sync
- `set-pro-status`: Manually set Pro status (legacy)

### Extension Popup
**File**: `chrome-extension/popup.js`
- Reads `isPro` from storage
- Hides upgrade button for Pro users
- Shows Pro badge/tier

## Database Schema

### customers Table
```sql
CREATE TABLE customers (
  id UUID PRIMARY KEY,
  supabase_user_id UUID REFERENCES auth.users(id),
  stripe_customer_id TEXT UNIQUE,
  email TEXT,
  subscription_id TEXT,
  subscription_status TEXT, -- 'active', 'inactive', 'past_due', 'canceled'
  plan_id TEXT,
  current_period_start TIMESTAMP,
  current_period_end TIMESTAMP,
  cancel_at_period_end BOOLEAN,
  last_payment_date TIMESTAMP,
  created_at TIMESTAMP,
  updated_at TIMESTAMP
);
```

## Testing the Flow

### 1. Test Payment (Stripe Test Mode)
```
Card: 4242 4242 4242 4242
Expiry: Any future date
CVC: Any 3 digits
```

### 2. Verify Webhook
- Check server logs for: `✅ Customer subscription activated successfully`
- Verify customers table updated in Supabase

### 3. Test Extension Sync
- Open extension popup
- Check console for: `✅ HWGPT: Subscription synced - isPro: true`
- Verify unlimited enhancements work

### 4. Manual Sync Test
```javascript
// In extension background page console
chrome.runtime.sendMessage({ action: 'sync-subscription' }, console.log);
```

## Troubleshooting

### Pro Not Activating?

1. **Check Supabase User Link**
   - Verify `supabaseUserId` in extension storage
   - Check customers table has matching user ID

2. **Check Subscription Status**
   - Query: `SELECT * FROM customers WHERE subscription_status = 'active'`
   - Verify subscription_id exists

3. **Manual Activation**
   ```javascript
   // In extension background console
   chrome.storage.local.set({ 
     isPro: true, 
     proExpiry: Date.now() + (30 * 24 * 60 * 60 * 1000),
     tier: 'Pro'
   });
   ```

4. **Check Webhook Logs**
   - Verify Stripe webhook is hitting your server
   - Check for errors in webhook handler

### Common Issues

**Issue**: User paid but still shows Free tier
- **Solution**: User needs to log into main app to link account
- **Alternative**: Use pro-activated.html page after payment

**Issue**: Extension not syncing
- **Solution**: Check Supabase URL and API key in background.js
- **Alternative**: Restart extension or browser

**Issue**: Subscription shows active but isPro is false
- **Solution**: Check plan_id is not 'free'
- **Alternative**: Manually trigger sync

## Production Checklist

- [ ] Stripe webhook URL configured in Stripe dashboard
- [ ] Stripe webhook secret set in environment variables
- [ ] Supabase customers table created with proper schema
- [ ] Extension has correct Supabase URL and anon key
- [ ] Payment link updated in extension (popup.js, background.js)
- [ ] Success URL redirects to pro-activated.html or settings page
- [ ] Test payment flow end-to-end
- [ ] Verify Pro benefits activate within 5 minutes
- [ ] Test subscription cancellation flow
- [ ] Monitor webhook logs for errors

## Support

If users report Pro not activating:
1. Check their email in customers table
2. Verify subscription_status is 'active'
3. Ask them to reload extension
4. Manually link their account if needed
5. Check webhook delivery in Stripe dashboard
