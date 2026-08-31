import { describe, expect, it } from 'vitest';
import { defaultOfferingType, getConversationGuidance, getTrainingPlan, inferBusinessType, knowledgeDomain, normalizeBusinessType, safeReferenceInsights, testPrompts } from './adaptive-training.service';

describe('adaptive business training', () => {
    it.each([
        ['Fashion', 'ECOMMERCE'], ['Visa consultancy', 'VISA_CONSULTANCY'], ['Study abroad', 'EDUCATION_CONSULTANCY'],
        ['EdTech', 'EDTECH'], ['Agency', 'AGENCY'], ['Real estate', 'REAL_ESTATE'], ['Clinic', 'CLINIC_SERVICE'],
        ['Restaurant', 'RESTAURANT'], ['SaaS', 'SAAS'], ['Other', 'OTHER'],
    ])('normalizes %s without exposing storage labels', (input, expected) => expect(normalizeBusinessType(input)).toBe(expected));

    it('infers but does not confirm a business type', () => {
        expect(inferBusinessType('Canada student visa passport embassy consultation')).toMatchObject({ businessType: 'VISA_CONSULTANCY' });
    });

    it('uses critical gaps to gate readiness', () => {
        const blocked = getTrainingPlan({ businessType: 'AGENCY' }, { offeringCount: 0, facts: '' });
        const ready = getTrainingPlan({ businessType: 'AGENCY', phone: '01700' }, { offeringCount: 2, facts: 'request a quote booking process' });
        expect(blocked.ready).toBe(false);
        expect(blocked.gaps.some((gap) => gap.priority === 'CRITICAL')).toBe(true);
        expect(ready.ready).toBe(true);
    });

    it('suppresses irrelevant questions and re-evaluates gaps when type changes', () => {
        const ecommerce = getTrainingPlan({ businessType: 'ECOMMERCE' }, { productCount: 1 });
        const visa = getTrainingPlan({ businessType: 'VISA_CONSULTANCY' }, { facts: 'Canada student visa' });
        expect(ecommerce.gaps.some((gap) => /visa|intake/i.test(gap.question))).toBe(false);
        expect(visa.gaps.some((gap) => /stock|variant|size/i.test(gap.question))).toBe(false);
        expect(ecommerce.gaps.map((gap) => gap.id)).not.toEqual(visa.gaps.map((gap) => gap.id));
    });

    it('assigns approved information to a business-specific knowledge domain', () => {
        expect(knowledgeDomain('VISA_CONSULTANCY', 'Required documents include a passport')).toBe('DOCUMENTS');
        expect(knowledgeDomain('EDTECH', 'Batch start and class schedule')).toBe('SCHEDULE');
        expect(knowledgeDomain('ECOMMERCE', 'Our return and exchange policy')).toBe('RETURN');
    });

    it('maps non-commerce inventory to typed offerings', () => {
        expect(defaultOfferingType('EDTECH')).toBe('COURSE');
        expect(defaultOfferingType('REAL_ESTATE')).toBe('PROPERTY');
        expect(defaultOfferingType('RESTAURANT')).toBe('MENU_ITEM');
    });

    it('provides domain-specific test and conversation behavior', () => {
        expect(testPrompts('EDTECH')[0]).toContain('SSC 27');
        expect(getConversationGuidance('CLINIC_SERVICE').safety).toContain('Never diagnose');
        expect(getConversationGuidance('VISA_CONSULTANCY').leadFields).toContain('visaType');
    });

    it('keeps reference learning structural and excludes source facts', () => {
        const result = safeReferenceInsights('Consultation fee 5000. Guaranteed visa. Book consultation.', 'VISA_CONSULTANCY');
        expect(JSON.stringify(result)).not.toContain('5000');
        expect(JSON.stringify(result)).not.toContain('Guaranteed visa');
        expect(result.safety).toContain('No prices');
    });

    it.each([
        ['ECOMMERCE', 1, 0, '5000 er moddhe smartwatch'],
        ['VISA_CONSULTANCY', 0, 1, 'Canada student visa'],
        ['EDTECH', 0, 1, 'SSC 27 science'],
        ['OTHER', 0, 1, 'Apnara ki service den'],
    ])('builds a coherent %s runtime scenario', (businessType, productCount, offeringCount, expectedPrompt) => {
        const plan = getTrainingPlan({ businessType, customBusinessType: businessType === 'OTHER' ? 'Tailoring studio' : undefined }, { productCount, offeringCount });
        expect(plan.businessType).toBe(businessType);
        expect(testPrompts(businessType)[0]).toContain(expectedPrompt);
        expect(getConversationGuidance(businessType).leadFields.length).toBeGreaterThan(2);
    });
});
