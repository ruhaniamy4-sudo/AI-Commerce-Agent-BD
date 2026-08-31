import { afterEach, describe, expect, it, vi } from 'vitest';
import { withTenantContext } from '../../tenancy/context';

const { findOne, pageBusiness } = vi.hoisted(() => ({ findOne: vi.fn(), pageBusiness: vi.fn() }));
vi.mock('../../models/BusinessChannel', () => ({ BusinessChannel: { findOne } }));
vi.mock('../meta-credentials.service', () => ({ decryptMetaAccessToken: () => 'page-token' }));
vi.mock('../meta-graph.service', () => ({
    MetaGraphError: class MetaGraphError extends Error { constructor(public category: string) { super(category); } },
    metaGraph: { pageBusiness },
}));

import { FacebookPermissionError, importAuthorizedFacebookPage } from './facebook-ingestion.service';

const context = { businessId: '507f1f77bcf86cd799439011', userId: 'u', membershipId: 'm', role: 'Owner' as const };
const run = <T>(work: () => Promise<T>) => withTenantContext(context, work);

describe('authorized Facebook business ingestion', () => {
    afterEach(() => vi.clearAllMocks());
    it('fails gracefully when the tenant connection lacks content permission', async () => {
        findOne.mockReturnValue({ select: vi.fn().mockResolvedValue(null) });
        await expect(run(() => importAuthorizedFacebookPage('page-1'))).rejects.toBeInstanceOf(FacebookPermissionError);
    });
    it('extracts only officially returned authorized Page data', async () => {
        findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ encryptedAccessToken: 'encrypted', permissions: ['pages_read_engagement'] }) });
        pageBusiness.mockResolvedValue({ id: 'page-1', name: 'Ruhan Shop', about: 'Bangladeshi fashion store', phone: '+8801700000000', emails: ['hello@example.com'] });
        const result = await run(() => importAuthorizedFacebookPage('page-1'));
        expect(result.business).toMatchObject({ name: 'Ruhan Shop', phone: '+8801700000000', email: 'hello@example.com' });
        expect(result.knowledge).toHaveLength(1); expect(result.products).toEqual([]);
    });
    it('does not fabricate data when Meta is unavailable', async () => {
        findOne.mockReturnValue({ select: vi.fn().mockResolvedValue({ encryptedAccessToken: 'encrypted', permissions: ['pages_read_engagement'] }) });
        pageBusiness.mockRejectedValue(new Error('unavailable'));
        await expect(run(() => importAuthorizedFacebookPage('page-1'))).rejects.toThrow('currently unavailable');
    });
});
