import { describe, expect, it } from 'vitest';
import { budgetFrom, extractTurnMemory, memoryPromptLine, mergeMemory } from './conversation-memory.service';

describe('conversation memory', () => {
    it('reads a budget the way customers actually state one', () => {
        expect(budgetFrom('3000 er moddhe kichu ache?')).toBe(3000);
        expect(budgetFrom('budget 5000')).toBe(5000);
        expect(budgetFrom('5k er vitore')).toBe(5000);
        expect(budgetFrom('2 hajar taka er modhye')).toBe(2000);
        expect(budgetFrom('under 1500')).toBe(1500);
        expect(budgetFrom('৳2500 er moddhe')).toBe(2500);
        // A bare number is not a budget.
        expect(budgetFrom('01712345678')).toBeUndefined();
        expect(budgetFrom('2 ta nibo')).toBeUndefined();
    });

    it('keeps the facts a salesperson would write on a notepad', () => {
        expect(extractTurnMemory('amar 3000 er moddhe ekta kalo hoodie lagbe, size L, Dhaka te')).toMatchObject({
            budget: 3000, color: 'Black', size: 'L', city: 'Dhaka',
        });
        expect(extractTurnMemory('gift er jonno lagbe, kalke dorkar')).toMatchObject({ purpose: 'gift', deadline: 'kalke' });
        expect(extractTurnMemory('Name: Rafi Islam, Phone: 01712345678')).toMatchObject({
            customerName: 'Rafi Islam', customerPhone: '01712345678',
        });
    });

    it('never forgets a fact because a later message did not repeat it', () => {
        const turn1 = mergeMemory(undefined, extractTurnMemory('3000 er moddhe kichu dekhan'));
        const turn2 = mergeMemory(turn1, extractTurnMemory('size L hole valo hoy'));
        const turn3 = mergeMemory(turn2, extractTurnMemory('thik ache'));
        expect(turn3).toMatchObject({ budget: 3000, size: 'L' });

        // A restated fact wins over the older one.
        const turn4 = mergeMemory(turn3, extractTurnMemory('na, 5000 er moddhe dekhan'));
        expect(turn4.budget).toBe(5000);
        expect(turn4.size).toBe('L');
    });

    it('costs almost nothing to carry and nothing at all when empty', () => {
        expect(memoryPromptLine(undefined)).toBe('');
        expect(memoryPromptLine({})).toBe('');
        const line = memoryPromptLine({
            customerName: 'Rafi', city: 'Dhaka', budget: 3000, size: 'L',
            activeProductName: 'Power Bank 20000mAh', activeProductCode: 'POW-2769B', activeProductPrice: 2600,
            detectedLanguage: 'banglish', conversationStage: 'PRODUCT_SEARCH',
        });
        expect(line).toContain('Rafi');
        expect(line).toContain('POW-2769B');
        expect(line).toContain('do not ask again');
        // Routing bookkeeping is not worth prompt tokens.
        expect(line).not.toContain('banglish');
        expect(line).not.toContain('PRODUCT_SEARCH');
        expect(Math.ceil(line.length / 4)).toBeLessThan(60);
    });
});
