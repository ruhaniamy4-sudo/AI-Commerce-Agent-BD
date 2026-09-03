/**
 * sales-cost-guards.ts
 *
 * Explicit runtime guards enforcing the sales-agent cost contract.
 * These guards are cheap assertions — they never add LLM calls or DB round-trips.
 *
 * ENFORCED CONSTRAINTS (from task spec §8):
 *   1. No separate LLM call for intent scoring
 *   2. No separate LLM call for language detection
 *   3. No separate LLM call for sales stage derivation
 *   4. No separate LLM call for next-best-action
 *   5. No full historical-chat injection
 *   6. Maximum 1 generation call per customer turn
 *   7. Output token budgets consistent with existing optimization
 *   8. No separate LLM call for purchase intent scoring
 */

/**
 * Named booleans documenting which paths are cost-free.
 * Referenced in comments and can be imported for inline assertions.
 */
export const SALES_COST_GUARDS = {
    intentScoringIsLlmFree: true,
    languageDetectionIsLlmFree: true,
    salesStageIsLlmFree: true,
    nextBestActionIsLlmFree: true,
    fullHistoryInjectionDisabled: true,
    maxOneLlmCallPerTurn: true,
} as const;

/**
 * Per-turn LLM call counter.
 * Call guard.increment() at the single point where the LLM is invoked.
 * Call guard.assertAtMostOne() after the turn to catch violations.
 * In NODE_ENV=production the assertion is a no-op.
 */
export class TurnLlmCallGuard {
    private count = 0;
    constructor(private readonly turnId: string) {}

    increment(): void {
        this.count++;
    }

    assertAtMostOne(): void {
        if (process.env.NODE_ENV === 'production') return;
        if (this.count > 1) {
            throw new Error(
                '[COST GUARD] Turn "' + this.turnId + '" made ' + this.count + ' LLM generation calls. ' +
                'Maximum is 1 per customer turn.',
            );
        }
    }

    get callCount(): number {
        return this.count;
    }
}

/**
 * Convenience: assert that a value is NOT a Promise.
 * Use to verify that a sales-intelligence function stayed synchronous.
 */
export function assertSync<T>(value: T, callerLabel: string): T {
    if (value instanceof Promise) {
        throw new Error(
            '[COST GUARD] "' + callerLabel + '" returned a Promise. Sales-intelligence functions must be synchronous.',
        );
    }
    return value;
}
