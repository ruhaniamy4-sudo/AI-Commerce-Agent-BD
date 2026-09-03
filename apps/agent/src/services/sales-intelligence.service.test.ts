/**
 * sales-intelligence.service.test.ts
 *
 * Focused tests for the sales-agent foundation.
 * All functions under test are pure — zero DB calls, zero LLM calls.
 * Tests cover:
 *   - Intent scoring rules
 *   - Sales stage transitions
 *   - Next-best-action derivation
 *   - Terminal stage protection (ORDERED / LOST never downgraded)
 *   - Prompt snippet generation
 *   - Zero-LLM path contract
 */

import { describe, it, expect } from 'vitest';
import {
    scorePurchaseIntent,
    deriveSalesStage,
    deriveNextBestAction,
    computeSalesSignals,
    buildSalesContextSnippet,
    type SalesSignals,
} from './sales-intelligence.service';
import type { SalesStage } from '../models/Conversation';

// ─── Intent scoring ───────────────────────────────────────────────────────────

describe('scorePurchaseIntent — individual signal rules', () => {
    it('returns 0 for an empty / unrelated message', () => {
        expect(scorePurchaseIntent('hello there')).toBe(0);
    });

    it('adds +25 for order confirmation language', () => {
        const score = scorePurchaseIntent('I want to confirm my order');
        expect(score).toBeGreaterThanOrEqual(25);
    });

    it('adds +15 for price inquiry', () => {
        const score = scorePurchaseIntent('price koto?');
        expect(score).toBeGreaterThanOrEqual(15);
    });

    it('adds +15 for stock inquiry', () => {
        const score = scorePurchaseIntent('stock ache?');
        expect(score).toBeGreaterThanOrEqual(15);
    });

    it('adds +10 for delivery charge inquiry', () => {
        const score = scorePurchaseIntent('delivery charge koto?');
        expect(score).toBeGreaterThanOrEqual(10);
    });

    it('adds +10 for COD / payment method inquiry', () => {
        const score = scorePurchaseIntent('cod available?');
        expect(score).toBeGreaterThanOrEqual(10);
    });

    it('adds +12 for size/color/variant inquiry', () => {
        const score = scorePurchaseIntent('black color available?');
        expect(score).toBeGreaterThanOrEqual(12);
    });

    it('adds +8 for image/details inquiry', () => {
        const score = scorePurchaseIntent('picture deo');
        expect(score).toBeGreaterThanOrEqual(8);
    });

    it('adds +20 for order process inquiry', () => {
        const score = scorePurchaseIntent('how to order?');
        expect(score).toBeGreaterThanOrEqual(20);
    });

    it('adds +20 for providing address', () => {
        const score = scorePurchaseIntent('delivery address: house 5, road 3, Dhaka');
        expect(score).toBeGreaterThanOrEqual(20);
    });

    it('adds +10 for location (city)', () => {
        const score = scorePurchaseIntent('ami Dhaka te achi');
        expect(score).toBeGreaterThanOrEqual(10);
    });

    it('adds +5 bonus for repeat product interest (hasActiveProduct=true)', () => {
        const withoutBonus = scorePurchaseIntent('price koto?', false);
        const withBonus = scorePurchaseIntent('price koto?', true);
        expect(withBonus).toBe(withoutBonus + 5);
    });

    it('subtracts 10 for objection language', () => {
        const neutralScore = scorePurchaseIntent('price koto?');
        const objectionScore = scorePurchaseIntent('price beshi, price koto?');
        expect(objectionScore).toBe(Math.max(0, neutralScore - 10));
    });

    it('caps score at 100 even with multiple signals', () => {
        const text = 'confirm order, address Dhaka, phone 01711111111, cod, delivery charge, price, stock, black, picture, how to order';
        expect(scorePurchaseIntent(text)).toBe(100);
    });

    it('never goes below 0', () => {
        expect(scorePurchaseIntent('price beshi onno jaygay better elsewhere')).toBeGreaterThanOrEqual(0);
    });

    it('handles Bangla script signals', () => {
        const score = scorePurchaseIntent('দাম কত? নীল রং আছে?');
        expect(score).toBeGreaterThanOrEqual(15 + 12);
    });
});

// ─── Sales stage derivation ───────────────────────────────────────────────────

describe('deriveSalesStage — stage transitions', () => {
    it('returns NEW when score is 0 and no product intent', () => {
        expect(deriveSalesStage(0, 'GENERAL_CONVERSATION', 'hi there')).toBe('NEW');
    });

    it('returns DISCOVERY when score > 0 but < 40', () => {
        expect(deriveSalesStage(15, 'PRODUCT_PRICE', 'price koto?')).toBe('DISCOVERY');
    });

    it('returns INTERESTED when score >= 40', () => {
        expect(deriveSalesStage(42, 'PRODUCT_PRICE', 'dam koto, stock ache?')).toBe('INTERESTED');
    });

    it('returns READY_TO_BUY when score >= 80', () => {
        expect(deriveSalesStage(80, 'PRODUCT_PRICE', 'dam koto, Dhaka, address dibo')).toBe('READY_TO_BUY');
    });

    it('returns OBJECTION when objection keyword appears', () => {
        expect(deriveSalesStage(35, 'PRODUCT_PRICE', 'price beshi, other shop better')).toBe('OBJECTION');
    });

    it('returns ORDERED when ORDER_STATUS intent + tracking language', () => {
        expect(deriveSalesStage(10, 'ORDER_STATUS', 'order status koi, parcel track')).toBe('ORDERED');
    });

    it('returns ORDERED when high score + confirmation keyword', () => {
        expect(deriveSalesStage(65, 'PRODUCT_PRICE', 'confirm order now, address Dhaka')).toBe('ORDERED');
    });

    it('returns LOST when HUMAN_HANDOFF intent', () => {
        expect(deriveSalesStage(0, 'HUMAN_HANDOFF', 'talk to human agent')).toBe('LOST');
    });

    it('returns DISCOVERY for product intents even with score=0', () => {
        expect(deriveSalesStage(0, 'PRODUCT_SEARCH', 'show me something')).toBe('DISCOVERY');
    });

    // Terminal state protection
    it('never downgrades ORDERED even with low score', () => {
        expect(deriveSalesStage(0, 'GENERAL_CONVERSATION', 'hi', 'ORDERED')).toBe('ORDERED');
    });

    it('never downgrades LOST stage', () => {
        expect(deriveSalesStage(100, 'PRODUCT_PRICE', 'price koto?', 'LOST')).toBe('LOST');
    });

    it('allows transition from DISCOVERY to INTERESTED as score rises', () => {
        expect(deriveSalesStage(45, 'PRODUCT_PRICE', 'dam koto? delivery charge? cod?', 'DISCOVERY')).toBe('INTERESTED');
    });

    it('allows transition from INTERESTED to READY_TO_BUY', () => {
        // Use a message that has high score but no confirmation keyword
        // address(+20) + Dhaka(+10) + phone(+20) = 50, but capped by score param=82
        // Use score=82 directly — no 'confirm' word to avoid triggering ORDERED
        expect(deriveSalesStage(82, 'PRODUCT_PRICE', 'address Dhaka, please send phone number', 'INTERESTED')).toBe('READY_TO_BUY');
    });
});

// ─── Next-best-action derivation ──────────────────────────────────────────────

describe('deriveNextBestAction — routing table', () => {
    const stages: Array<[SalesStage, string, ReturnType<typeof deriveNextBestAction>]> = [
        ['ORDERED', 'ORDER_STATUS', 'ANSWER_FACT'],
        ['ORDERED', 'GENERAL_CONVERSATION', 'ANSWER_FACT'],
        ['READY_TO_BUY', 'PRODUCT_PRICE', 'ASK_ORDER_DETAILS'],
        ['OBJECTION', 'GENERAL_CONVERSATION', 'HANDLE_OBJECTION'],
        ['LOST', 'GENERAL_CONVERSATION', 'FOLLOW_UP_LATER'],
        ['INTERESTED', 'PRODUCT_SEARCH', 'RECOMMEND_PRODUCT'],
        ['INTERESTED', 'PRODUCT_COMPARE', 'RECOMMEND_PRODUCT'],
        ['INTERESTED', 'PRODUCT_PRICE', 'CROSS_SELL'],
        ['INTERESTED', 'PRODUCT_STOCK', 'CROSS_SELL'],
        ['DISCOVERY', 'HUMAN_HANDOFF', 'HANDOFF'],
        ['DISCOVERY', 'KNOWLEDGE', 'ANSWER_FACT'],
        ['DISCOVERY', 'BUSINESS_FACT', 'ANSWER_FACT'],
        ['DISCOVERY', 'ORDER_STATUS', 'ANSWER_FACT'],
        ['DISCOVERY', 'PRODUCT_PRICE', 'ASK_ONE_QUALIFYING_QUESTION'],
        ['NEW', 'GENERAL_CONVERSATION', 'ASK_ONE_QUALIFYING_QUESTION'],
        ['NEW', 'HUMAN_HANDOFF', 'HANDOFF'],
    ];

    it.each(stages)('stage=%s intent=%s → action=%s', (stage, intent, expected) => {
        expect(deriveNextBestAction(stage, intent as any)).toBe(expected);
    });
});

// ─── computeSalesSignals (integration) ───────────────────────────────────────

describe('computeSalesSignals — combined wrapper', () => {
    it('returns all three fields', () => {
        const signals = computeSalesSignals('price koto?', 'PRODUCT_PRICE');
        expect(signals).toHaveProperty('intentScore');
        expect(signals).toHaveProperty('salesStage');
        expect(signals).toHaveProperty('nextBestAction');
    });

    it('full purchase flow: greeting → inquiry → ready → ordered', () => {
        const s1 = computeSalesSignals('hi', 'GENERAL_CONVERSATION');
        expect(s1.salesStage).toBe('NEW');

        // price(+15) + stock(+15) + cod(+10) + color black(+12) = 52 → INTERESTED
        const s2 = computeSalesSignals('price koto? stock ache? cod available? black color?', 'PRODUCT_PRICE', s1.salesStage);
        expect(s2.salesStage).toBe('INTERESTED');

        // address(+20) + Dhaka(+10) + phone(+20) + cod(+10) + delivery charge(+10) + price(+15) = 85 → READY_TO_BUY
        const s3 = computeSalesSignals('address house 5 road 3 Dhaka phone 01711111111 cod delivery charge price koto', 'BUSINESS_FACT', s2.salesStage);
        expect(s3.salesStage).toBe('READY_TO_BUY');

        // confirm(+25) + address(+20) + Dhaka(+10) + cod(+10) = 65 ≥ 60 → ORDERED
        const s4 = computeSalesSignals('confirm order, address Dhaka, cod payment', 'PRODUCT_PRICE', s3.salesStage);
        expect(s4.salesStage).toBe('ORDERED');

        // Once ordered, never downgrade
        const s5 = computeSalesSignals('hi', 'GENERAL_CONVERSATION', s4.salesStage);
        expect(s5.salesStage).toBe('ORDERED');
    });
});

// ─── Prompt snippet ───────────────────────────────────────────────────────────

describe('buildSalesContextSnippet — compact output', () => {
    it('always starts with SALES: prefix', () => {
        const snippet = buildSalesContextSnippet({ intentScore: 30, salesStage: 'DISCOVERY', nextBestAction: 'ASK_ONE_QUALIFYING_QUESTION' });
        expect(snippet).toMatch(/^SALES:/);
    });

    it('includes stage, score, and action', () => {
        const snippet = buildSalesContextSnippet({ intentScore: 55, salesStage: 'INTERESTED', nextBestAction: 'CROSS_SELL' });
        expect(snippet).toContain('INTERESTED');
        expect(snippet).toContain('55');
        expect(snippet).toContain('CROSS_SELL');
    });

    it('stays within ~120 tokens (≤600 chars) with a full playbook', () => {
        const signals: SalesSignals = { intentScore: 82, salesStage: 'READY_TO_BUY', nextBestAction: 'ASK_ORDER_DETAILS' };
        const snippet = buildSalesContextSnippet(signals, {
            addressingStyle: 'apu',
            ctaStyle: 'direct',
            persistenceLevel: 'high',
            crossSellTendency: 'high',
            preferredClosingPattern: 'আপু, order confirm korbo? Name, address, phone number diye den.',
            commonObjectionResponses: ['আমাদের quality guaranteed, আপনি satisfied na hoile refund dibo.'],
        });
        expect(snippet.length).toBeLessThanOrEqual(600);
    });

    it('only shows objection hint when stage is OBJECTION', () => {
        const objectionSignals: SalesSignals = { intentScore: 20, salesStage: 'OBJECTION', nextBestAction: 'HANDLE_OBJECTION' };
        const nonObjSignals: SalesSignals = { intentScore: 50, salesStage: 'INTERESTED', nextBestAction: 'CROSS_SELL' };
        const playbook = { commonObjectionResponses: ['Great value guaranteed!'] };
        expect(buildSalesContextSnippet(objectionSignals, playbook)).toContain('Objection hint');
        expect(buildSalesContextSnippet(nonObjSignals, playbook)).not.toContain('Objection hint');
    });

    it('only shows closing pattern when stage is READY_TO_BUY', () => {
        const readySignals: SalesSignals = { intentScore: 85, salesStage: 'READY_TO_BUY', nextBestAction: 'ASK_ORDER_DETAILS' };
        const intSignals: SalesSignals = { intentScore: 50, salesStage: 'INTERESTED', nextBestAction: 'CROSS_SELL' };
        const playbook = { preferredClosingPattern: 'Order korun ekhuni!' };
        expect(buildSalesContextSnippet(readySignals, playbook)).toContain('Close:');
        expect(buildSalesContextSnippet(intSignals, playbook)).not.toContain('Close:');
    });

    it('omits neutral style fields from snippet', () => {
        const snippet = buildSalesContextSnippet(
            { intentScore: 30, salesStage: 'DISCOVERY', nextBestAction: 'ASK_ONE_QUALIFYING_QUESTION' },
            { addressingStyle: 'neutral', ctaStyle: 'none', persistenceLevel: 'low', crossSellTendency: 'low' },
        );
        expect(snippet).not.toContain('address=');
        expect(snippet).not.toContain('CTA=');
        expect(snippet).not.toContain('persist=');
        expect(snippet).not.toContain('cross-sell=');
    });
});

// ─── Zero-LLM contract ────────────────────────────────────────────────────────

describe('zero-LLM contract — all sales-intelligence functions are pure', () => {
    it('scorePurchaseIntent is synchronous (no promise returned)', () => {
        const result = scorePurchaseIntent('price koto?');
        expect(typeof result).toBe('number');
        expect(result).not.toBeInstanceOf(Promise);
    });

    it('deriveSalesStage is synchronous', () => {
        const result = deriveSalesStage(40, 'PRODUCT_PRICE', 'dam koto?');
        expect(typeof result).toBe('string');
        expect(result).not.toBeInstanceOf(Promise);
    });

    it('deriveNextBestAction is synchronous', () => {
        const result = deriveNextBestAction('INTERESTED', 'PRODUCT_SEARCH');
        expect(typeof result).toBe('string');
        expect(result).not.toBeInstanceOf(Promise);
    });

    it('computeSalesSignals is synchronous', () => {
        const result = computeSalesSignals('price koto?', 'PRODUCT_PRICE');
        expect(result).not.toBeInstanceOf(Promise);
        expect(typeof result.intentScore).toBe('number');
    });

    it('buildSalesContextSnippet is synchronous', () => {
        const result = buildSalesContextSnippet({ intentScore: 30, salesStage: 'DISCOVERY', nextBestAction: 'ASK_ONE_QUALIFYING_QUESTION' });
        expect(typeof result).toBe('string');
        expect(result).not.toBeInstanceOf(Promise);
    });
});
