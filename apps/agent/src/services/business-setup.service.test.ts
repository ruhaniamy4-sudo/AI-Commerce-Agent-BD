import { afterEach, describe, expect, it, vi } from 'vitest';
import { Business } from '../models/Business';
import { Knowledge } from '../models/Knowledge';
import { withTenantContext } from '../tenancy/context';
import { saveConfirmedSetupAnswer, setupQuestionStorageKey } from './business-setup.service';

const businessId = '507f1f77bcf86cd799439011';
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'owner-1', membershipId: 'membership-1', role: 'Owner' }, work);

describe('confirmed guided business setup persistence', () => {
    afterEach(() => vi.restoreAllMocks());

    it('upserts a tenant-scoped confirmed fact with stable provenance', async () => {
        vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ businessType: 'ECOMMERCE', businessTypeStatus: 'confirmed' }) }) } as never);
        const update = vi.spyOn(Knowledge, 'findOneAndUpdate').mockResolvedValue({ structuredValue: 'Inside Dhaka ৳80', updatedAt: new Date() } as never);
        const result = await tenant(() => saveConfirmedSetupAnswer({ businessId, userId: 'owner-1', questionKey: 'delivery_charge', value: 'Inside Dhaka ৳80', merchantConfirmed: true }));

        expect(update).toHaveBeenCalledWith(
            { businessId, setupQuestionKey: 'ECOMMERCE:delivery_charge' },
            expect.objectContaining({ $set: expect.objectContaining({ merchantConfirmed: true, factSource: 'BUSINESS_SETUP', businessType: 'ECOMMERCE', structuredValue: 'Inside Dhaka ৳80' }) }),
            expect.objectContaining({ upsert: true, new: true })
        );
        expect(result).toMatchObject({ key: 'delivery_charge', merchantConfirmed: true, source: 'BUSINESS_SETUP' });
    });

    it('uses the same upsert identity on repeat saves so double submission cannot duplicate the fact', async () => {
        vi.spyOn(Business, 'findById').mockReturnValue({ select: () => ({ lean: () => Promise.resolve({ businessType: 'ECOMMERCE', businessTypeStatus: 'confirmed' }) }) } as never);
        const update = vi.spyOn(Knowledge, 'findOneAndUpdate').mockResolvedValue({ structuredValue: 'Yes', updatedAt: new Date() } as never);
        const input = { businessId, userId: 'owner-1', questionKey: 'cod', value: 'Yes', merchantConfirmed: true };
        await tenant(() => saveConfirmedSetupAnswer(input));
        await tenant(() => saveConfirmedSetupAnswer(input));
        expect(update).toHaveBeenCalledTimes(2);
        expect(update.mock.calls[0][0]).toEqual(update.mock.calls[1][0]);
        expect(update.mock.calls[0][0]).toEqual({ businessId, setupQuestionKey: 'ECOMMERCE:cod' });
    });

    it('refuses to persist an unconfirmed answer', async () => {
        const update = vi.spyOn(Knowledge, 'findOneAndUpdate');
        await expect(tenant(() => saveConfirmedSetupAnswer({ businessId, userId: 'owner-1', questionKey: 'cod', value: 'Yes', merchantConfirmed: false }))).rejects.toThrow('Confirm this answer');
        expect(update).not.toHaveBeenCalled();
    });

    it('keeps answers from different business types under distinct storage identities', () => {
        expect(setupQuestionStorageKey('ECOMMERCE', 'payment')).toBe('ECOMMERCE:payment');
        expect(setupQuestionStorageKey('VISA_CONSULTANCY', 'payment')).toBe('VISA_CONSULTANCY:payment');
        expect(setupQuestionStorageKey('ECOMMERCE', 'payment')).not.toBe(setupQuestionStorageKey('VISA_CONSULTANCY', 'payment'));
    });
});
