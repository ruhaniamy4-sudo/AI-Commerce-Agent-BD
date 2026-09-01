import { afterEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../models/Conversation';
import { withTenantContext } from '../tenancy/context';

const mocks = vi.hoisted(() => ({ match: vi.fn(), analyze: vi.fn() }));
vi.mock('./product-matcher.service', () => ({ matchProductsWithRAG: mocks.match, formatProductsForResponse: vi.fn() }));
vi.mock('./vision.service', async (importOriginal) => {
    const actual = await importOriginal<typeof import('./vision.service')>();
    return { ...actual, analyzeProductImage: mocks.analyze };
});

import { handleImageInput } from './image-processor.service';

const businessId = '507f1f77bcf86cd799439011';
const tenant = <T>(work: () => T) => withTenantContext({ businessId, userId: 'owner', membershipId: 'member', role: 'Owner' }, work);

describe('persisted image Vision flow', () => {
    afterEach(() => vi.restoreAllMocks());

    it('passes the stable managed URL to matching and Vision and retains media metadata in conversation context', async () => {
        const stableUrl = 'https://res.cloudinary.com/demo/image/upload/v1/sellpilot/business/customers/photo.png';
        const media: any = { provider: 'cloudinary', providerAssetId: 'sellpilot/business/customers/photo', secureUrl: stableUrl, resourceType: 'image', source: 'TEST_AI', createdAt: new Date(), retention: 'temporary', expiresAt: new Date(Date.now() + 60_000), retentionStatus: 'active' };
        mocks.match.mockResolvedValue([{ _id: '507f1f77bcf86cd799439012' }]);
        mocks.analyze.mockResolvedValue({ description: 'A black watch', category: 'watch', confidence: .9 });
        const update = vi.spyOn(Conversation, 'updateOne').mockResolvedValue({ matchedCount: 1 } as never);

        await tenant(() => handleImageInput(businessId, 'conversation-1', stableUrl, 'event-1', media));

        expect(mocks.match).toHaveBeenCalledWith(expect.objectContaining({ businessId, imageUrl: stableUrl, conversationId: 'conversation-1' }));
        expect(mocks.analyze).toHaveBeenCalledWith(stableUrl, expect.objectContaining({ conversationId: 'conversation-1' }));
        expect(update).toHaveBeenCalledWith({ conversationId: 'conversation-1' }, { $set: { imageContext: expect.objectContaining({ url: stableUrl, media: expect.objectContaining({ providerAssetId: media.providerAssetId }) }) } });
    });
});
