/**
 * sales-intelligence.service.ts
 *
 * COST CONTRACT:
 *   - ZERO DB calls
 *   - ZERO LLM calls
 *   - Pure synchronous functions only
 *
 * Provides:
 *   1. scorePurchaseIntent()       — 0-100 rule-based score from message signals
 *   2. deriveSalesStage()          — SalesStage from score + LightweightIntent
 *   3. deriveNextBestAction()      — NextBestAction from stage + intent
 *   4. computeSalesSignals()       — convenience wrapper returning all three
 *   5. buildSalesContextSnippet()  — compact ≤120-token string for prompt injection
 */

import { LightweightIntent } from './turn-routing.service';
import type { SalesStage } from '../models/Conversation';
import type { ISalesPlaybook } from '../models/Business';

// ─── Types ────────────────────────────────────────────────────────────────────

export type NextBestAction =
    | 'ANSWER_FACT'
    | 'ASK_ONE_QUALIFYING_QUESTION'
    | 'RECOMMEND_PRODUCT'
    | 'HANDLE_OBJECTION'
    | 'CROSS_SELL'
    | 'ASK_ORDER_DETAILS'
    | 'FOLLOW_UP_LATER'
    | 'HANDOFF';

export interface SalesSignals {
    intentScore: number;       // 0–100
    salesStage: SalesStage;
    nextBestAction: NextBestAction;
}

// ─── Intent scoring rules ─────────────────────────────────────────────────────
// Each regex matches a customer signal worth a fixed number of points.
// Total is capped at 100. No LLM call — pure deterministic regex.

const INTENT_RULES: Array<{ pattern: RegExp; points: number }> = [
    // Order confirmation signals (+25) — strongest buying signal
    // NOTE: \b does not match Unicode Bangla chars in JS; Bangla terms use their own patterns below
    { pattern: /\b(confirm|place order|buy now|order kori|nibo|checkout|order dite chai)\b/i, points: 25 },
    { pattern: /নিব|অর্ডার কর/, points: 25 },
    // Provides phone number (+20) — transaction readiness
    { pattern: /\b(\d{11}|\+88\d{10})\b/, points: 20 },
    // Provides delivery address (+20) — transaction readiness
    { pattern: /\b(address|delivery address|road|lane|house|flat|floor|moholla)\b/i, points: 20 },
    { pattern: /ঠিকানা|বাড়ির ঠিকানা|মহল্লা/, points: 20 },
    // Asks how to order (+20) — direct purchase intent
    { pattern: /\b(how to order|order kivabe|kivabe order|order process|order korbo kivabe)\b/i, points: 20 },
    { pattern: /কীভাবে অর্ডার|অর্ডার কীভাবে/, points: 20 },
    // Gives location (+10)
    { pattern: /\b(dhaka|chittagong|sylhet|khulna|rajshahi|barishal|mymensingh|rangpur|mirpur|gulshan|dhanmondi|uttara|gazipur|narayanganj)\b/i, points: 10 },
    // COD / payment inquiry (+10) — transaction readiness
    { pattern: /\b(cod|cash on delivery|bkash|nagad|rocket|payment|payment method)\b/i, points: 10 },
    { pattern: /পেমেন্ট|ক্যাশ অন ডেলিভারি/, points: 10 },
    // Delivery inquiry (+10) — logistics readiness
    { pattern: /\b(delivery charge|delivery cost|shipping|delivery time|delivery fee)\b/i, points: 10 },
    { pattern: /কতদিনে|ডেলিভারি চার্জ|ডেলিভারি টাইম/, points: 10 },
    // Size / color / variant (+12) — narrowing to purchase
    { pattern: /\b(size|color|colour|black|white|blue|red|green|yellow|pink|navy|grey)\b/i, points: 12 },
    { pattern: /সাইজ|রং|কালো|সাদা|নীল|লাল|সবুজ|হলুদ/, points: 12 },
    // Stock / availability (+15) — pre-purchase check
    { pattern: /\b(stock|available|availability|ache|ase|in stock|stocked)\b/i, points: 15 },
    { pattern: /আছে|পাওয়া যাবে/, points: 15 },
    // Price inquiry (+15) — active comparison
    { pattern: /\b(price|cost|dam|fee|koto|rate)\b/i, points: 15 },
    { pattern: /দাম|ফি|কত/, points: 15 },
    // Product image / details (+8) — evaluation signal
    { pattern: /\b(picture|photo|image|pic|details|specification|spec|dekhao)\b/i, points: 8 },
    { pattern: /ছবি|বিস্তারিত|দেখাও/, points: 8 },
];

// Objection signals — subtract 10 points and force OBJECTION stage
const OBJECTION_PATTERN = /\b(price beshi|too expensive|dam beshi|beshi dam|onno jaygay|other shop|other store|trust|original|fake|delivery charge beshi|better elsewhere)\b/i;

// Order-placed / tracking signal — forces ORDERED stage
const ORDER_PLACED_PATTERN = /\b(order placed|order confirmed|order status|track|parcel)\b/i;

// ─── Core pure functions ──────────────────────────────────────────────────────

/**
 * Compute a 0–100 purchase intent score from the customer message text.
 * Rule-based; no LLM call, no DB call.
 *
 * @param text             Current customer message
 * @param hasActiveProduct Whether conversation already has an activeProductId (repeat interest +5)
 */
export function scorePurchaseIntent(text: string, hasActiveProduct = false): number {
    let score = 0;

    for (const rule of INTENT_RULES) {
        if (rule.pattern.test(text)) {
            score += rule.points;
        }
    }

    // Repeat product interest: conversation already focused on a product
    if (hasActiveProduct) score += 5;

    // Objection subtracts 10 (cannot go below 0)
    if (OBJECTION_PATTERN.test(text)) score = Math.max(0, score - 10);

    return Math.min(100, score);
}

/**
 * Derive the sales stage from intent score + lightweight intent classification.
 * Pure function — no LLM, no DB.
 * Never downgrades ORDERED or LOST stages.
 */
export function deriveSalesStage(
    score: number,
    intent: LightweightIntent,
    text: string,
    currentStage?: SalesStage,
): SalesStage {
    // Terminal states — never downgrade
    if (currentStage === 'ORDERED') return 'ORDERED';
    if (currentStage === 'LOST') return 'LOST';

    // ORDER_STATUS intent + order-placed language → ORDERED
    if (ORDER_PLACED_PATTERN.test(text) && intent === 'ORDER_STATUS') return 'ORDERED';

    // Order confirmation keywords + high score → ORDERED
    if (/\b(confirm|place order|buy now|nibo|নিব|অর্ডার কর)\b/i.test(text) && score >= 60) return 'ORDERED';

    // Objection detected → OBJECTION
    if (OBJECTION_PATTERN.test(text)) return 'OBJECTION';

    // Score thresholds
    if (score >= 80) return 'READY_TO_BUY';
    if (score >= 40) return 'INTERESTED';
    if (score > 0) return 'DISCOVERY';

    // Zero score but still a product-related intent
    if (['PRODUCT_SEARCH', 'PRODUCT_PRICE', 'PRODUCT_STOCK', 'PRODUCT_IMAGE', 'PRODUCT_VARIANT', 'PRODUCT_COMPARE'].includes(intent)) return 'DISCOVERY';

    // Human handoff requested → LOST in sales funnel
    if (intent === 'HUMAN_HANDOFF') return 'LOST';

    return currentStage ?? 'NEW';
}

/**
 * Derive the single best next action from stage + intent.
 * Pure function — no LLM, no DB.
 */
export function deriveNextBestAction(stage: SalesStage, intent: LightweightIntent): NextBestAction {
    switch (stage) {
        case 'ORDERED':
            return 'ANSWER_FACT';
        case 'READY_TO_BUY':
            return 'ASK_ORDER_DETAILS';
        case 'OBJECTION':
            return 'HANDLE_OBJECTION';
        case 'LOST':
            return 'FOLLOW_UP_LATER';
        case 'INTERESTED':
            if (intent === 'PRODUCT_SEARCH' || intent === 'PRODUCT_COMPARE') return 'RECOMMEND_PRODUCT';
            return 'CROSS_SELL';
        case 'DISCOVERY':
            if (intent === 'HUMAN_HANDOFF') return 'HANDOFF';
            if (intent === 'KNOWLEDGE' || intent === 'BUSINESS_FACT' || intent === 'ORDER_STATUS') return 'ANSWER_FACT';
            return 'ASK_ONE_QUALIFYING_QUESTION';
        case 'NEW':
            if (intent === 'HUMAN_HANDOFF') return 'HANDOFF';
            return 'ASK_ONE_QUALIFYING_QUESTION';
        default:
            return 'ANSWER_FACT';
    }
}

/**
 * Convenience wrapper: compute all three signals in one call.
 * Pure function — no LLM, no DB.
 */
export function computeSalesSignals(
    text: string,
    intent: LightweightIntent,
    currentStage?: SalesStage,
    hasActiveProduct = false,
): SalesSignals {
    const intentScore = scorePurchaseIntent(text, hasActiveProduct);
    const salesStage = deriveSalesStage(intentScore, intent, text, currentStage);
    const nextBestAction = deriveNextBestAction(salesStage, intent);
    return { intentScore, salesStage, nextBestAction };
}

// ─── Prompt injection helper ──────────────────────────────────────────────────

/**
 * Build a compact sales context snippet for injection into the existing LLM system prompt.
 * Target: ≤120 tokens. Keeps the maximum-one-generation-call-per-turn contract intact.
 * Called only when an LLM turn is actually needed; zero-LLM paths never touch this.
 */
export function buildSalesContextSnippet(
    signals: SalesSignals,
    playbook?: ISalesPlaybook,
): string {
    const parts: string[] = [
        `SALES: stage=${signals.salesStage}, score=${signals.intentScore}, action=${signals.nextBestAction}.`,
    ];

    if (playbook) {
        const style: string[] = [];
        if (playbook.addressingStyle && playbook.addressingStyle !== 'neutral') style.push(`address="${playbook.addressingStyle}"`);
        if (playbook.ctaStyle && playbook.ctaStyle !== 'none') style.push(`CTA=${playbook.ctaStyle}`);
        if (playbook.persistenceLevel && playbook.persistenceLevel !== 'low') style.push(`persist=${playbook.persistenceLevel}`);
        if (playbook.crossSellTendency && playbook.crossSellTendency !== 'low') style.push(`cross-sell=${playbook.crossSellTendency}`);
        if (style.length) parts.push(`Style: ${style.join('; ')}.`);

        // Objection hint only when in OBJECTION stage
        if (signals.salesStage === 'OBJECTION' && playbook.commonObjectionResponses?.length) {
            const hint = playbook.commonObjectionResponses[0]?.slice(0, 150);
            if (hint) parts.push(`Objection hint: "${hint}".`);
        }

        // Closing pattern only when READY_TO_BUY
        if (signals.salesStage === 'READY_TO_BUY' && playbook.preferredClosingPattern) {
            parts.push(`Close: "${playbook.preferredClosingPattern.slice(0, 200)}".`);
        }
    }

    return parts.join(' ');
}
