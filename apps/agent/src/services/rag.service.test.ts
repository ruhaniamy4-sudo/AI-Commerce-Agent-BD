import { afterEach, describe, expect, it, vi } from 'vitest';
import { HumanMessage } from '@langchain/core/messages';
import { Customer } from '../models/Customer';
import { Knowledge } from '../models/Knowledge';
import { Product } from '../models/Product';
import { Offering } from '../models/Offering';
import { withTenantContext } from '../tenancy/context';
import { formatContextPack, retrieveContext } from './rag.service';
import { buildKnowledgeSearchProfile, buildProductSearchProfile } from './knowledge-intelligence.service';

vi.mock('./business-awareness.service', () => ({ retrieveRelevantAwareness: vi.fn(async () => []) }));

function knowledgeResult(records: any[]) {
    return { select: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(records) }) }) };
}

function productResult(records: any[]) {
    return { limit: vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(records) }) }) };
}

describe('targeted RAG limits', () => {
    afterEach(() => {
        vi.restoreAllMocks();
        delete process.env.RAG_TOP_K;
    });

    function noOfferings() {
        vi.spyOn(Offering, 'find').mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as never);
    }

    it('applies the configured low top-k to knowledge and product candidates', async () => {
        noOfferings();
        process.env.RAG_TOP_K = '2';
        vi.spyOn(Customer, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
        const knowledgeLimit = vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) });
        vi.spyOn(Knowledge, 'find').mockReturnValue({ select: vi.fn().mockReturnValue({ limit: knowledgeLimit }) } as never);
        const productLimit = vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }),
        });
        vi.spyOn(Product, 'find').mockReturnValue({ limit: productLimit } as never);
        const businessId = '507f1f77bcf86cd799439011';
        await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            retrieveContext(businessId, 'customer', 'blue laptop availability', [])
        );
        expect(knowledgeLimit).toHaveBeenCalledWith(6);
        expect(productLimit).toHaveBeenCalledWith(12);
    });

    it('combines conversation memory with Banglish color, size, category, and budget constraints', async () => {
        noOfferings();
        vi.spyOn(Customer, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
        vi.spyOn(Knowledge, 'find').mockReturnValue(knowledgeResult([]) as never);
        const matching: any = { name: 'Black Oxford Shirt', description: 'Cotton shirt', basePrice: 1800, stock: 3, availability: 'in_stock', specs: { color: 'Black' }, variants: [{ name: 'Black XL', stock: 3, isActive: true, specs: { size: 'XL', color: 'Black' } }], intelligence: undefined };
        matching.intelligence = buildProductSearchProfile(matching);
        const expensive: any = { ...matching, name: 'Premium Black Shirt', basePrice: 2400 };
        expensive.intelligence = buildProductSearchProfile(expensive);
        vi.spyOn(Product, 'find').mockReturnValue(productResult([matching, expensive]) as never);
        const businessId = '507f1f77bcf86cd799439011';
        const result = await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            retrieveContext(businessId, 'customer', 'kalo XL ache?', [new HumanMessage('Budget 2000, shirt dekhaw')])
        );
        expect(result.query).toMatchObject({ budgetMax: 2000, colors: ['black'], sizes: ['XL'], categories: ['shirt'] });
        expect(result.catalogHits.map((product) => product.name)).toEqual(['Black Oxford Shirt']);
    });

    it('combines multiple approved knowledge records and labels their authority', async () => {
        noOfferings();
        vi.spyOn(Customer, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
        const charge: any = { title: 'Dhaka delivery charge', content: 'Inside Dhaka delivery is 70 tk.', type: 'POLICY', status: 'active', merchantConfirmed: true, isPinned: true, sourcePriority: 'high' };
        const time: any = { title: 'Delivery time and COD', content: 'Delivery takes 1-2 business days. COD is available.', type: 'FAQ', status: 'active', merchantConfirmed: true };
        charge.intelligence = buildKnowledgeSearchProfile(charge);
        time.intelligence = buildKnowledgeSearchProfile(time);
        vi.spyOn(Knowledge, 'find').mockReturnValue(knowledgeResult([charge, time]) as never);
        vi.spyOn(Product, 'find').mockReturnValue(productResult([]) as never);
        const businessId = '507f1f77bcf86cd799439011';
        const result = await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            retrieveContext(businessId, 'customer', 'Dhakay delivery koto ar koydin lage, COD ache?', [])
        );
        expect(result.knowledgeEntries).toHaveLength(2);
        const packed = JSON.parse(formatContextPack(result));
        expect(packed.approved_knowledge.every((entry: any) => entry.authority === 'APPROVED_KNOWLEDGE')).toBe(true);
        expect(JSON.stringify(packed.approved_knowledge)).toContain('cod_available');
    });

    it('puts canonical current product price and stock ahead of approved knowledge', async () => {
        noOfferings();
        vi.spyOn(Customer, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
        vi.spyOn(Knowledge, 'find').mockReturnValue(knowledgeResult([{ title: 'Old catalog note', content: 'Black shirt was 1200', type: 'GUIDE', merchantConfirmed: true }]) as never);
        const product = { name: 'Black Shirt', description: 'Black cotton shirt', basePrice: 1490, stock: 2, availability: 'in_stock', specs: {}, variants: [], merchantConfirmed: true };
        vi.spyOn(Product, 'find').mockReturnValue(productResult([{ ...product, intelligence: buildProductSearchProfile(product) }]) as never);
        const businessId = '507f1f77bcf86cd799439011';
        const result = await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            retrieveContext(businessId, 'customer', 'black shirt price stock', [])
        );
        const packed = JSON.parse(formatContextPack(result));
        expect(packed.trust_order[0]).toBe('canonical_product_service_inventory');
        expect(packed.canonical_catalog_matches[0]).toMatchObject({ price: 1490, stock: 2, authority: 'CANONICAL_CURRENT_PRODUCT' });
    });

    it('retrieves budget-only discovery and labels a factual alternative when an exact attribute is unavailable', async () => {
        noOfferings();
        vi.spyOn(Customer, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue(null) } as never);
        vi.spyOn(Knowledge, 'find').mockReturnValue(knowledgeResult([]) as never);
        const navy: any = { name: 'Navy Casual Shirt', description: 'Navy casual shirt', basePrice: 1900, stock: 5, availability: 'in_stock', specs: { color: 'Navy' }, variants: [], merchantConfirmed: true };
        navy.intelligence = buildProductSearchProfile(navy);
        vi.spyOn(Product, 'find').mockReturnValue(productResult([navy]) as never);
        const businessId = '507f1f77bcf86cd799439011';
        const result = await withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Staff' }, () =>
            retrieveContext(businessId, 'customer', '2k er moddhe black shirt dekhaw', [])
        );
        expect(result.query.budgetMax).toBe(2000);
        expect(result.catalogHits[0]).toMatchObject({ name: 'Navy Casual Shirt', _matchKind: 'closest_supported_alternative' });
    });
});
