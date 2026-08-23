import { afterEach, describe, expect, it, vi } from 'vitest';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { withTenantContext } from '../tenancy/context';
import { retrieveContext } from './rag.service';

describe('targeted RAG limits', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.RAG_TOP_K;
    });

    it('applies the configured low top-k to knowledge and product candidates', async () => {
        process.env.RAG_TOP_K = '2';
        vi.spyOn(Customer, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
        const knowledgeLimit = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
        vi.spyOn(Knowledge, 'find').mockReturnValue({ limit: knowledgeLimit } as never);
        const productLimit = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
        });
        vi.spyOn(Product, 'find').mockReturnValue({ limit: productLimit } as never);
        const businessId = '507f1f77bcf86cd799439011';
        await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            retrieveContext(businessId, 'customer', 'blue laptop availability', [])
        );
        expect(knowledgeLimit).toHaveBeenCalledWith(2);
        expect(productLimit).toHaveBeenCalledWith(2);
    });
});
