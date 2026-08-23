import { Product } from '../models/Product';
import { Knowledge } from '../models/Knowledge';
import { Customer } from '../models/Customer';
import { Order } from '../models/Order';
import { BaseMessage } from '@langchain/core/messages';
import { assertTenantBusinessId } from '../tenancy/context';

interface RAGContext {
    businessId: string;
    catalogHits: any[];
    knowledgeEntries: any[];
    customerProfile: any;
    lastOrders: any[];
}

export const retrieveContext = async (
    businessId: string,
    psid: string,
    messageText: string,
    history: BaseMessage[]
): Promise<RAGContext> => {
    assertTenantBusinessId(businessId, 'rag.retrieveContext');
    // 1. Identify Customer & History
    const customer = await Customer.findOne({ psid }).lean();
    let lastOrders: any[] = [];
    if (customer) {
        lastOrders = await Order.find({ customerId: customer._id })
            .sort({ createdAt: -1 })
            .limit(3)
            .lean();
    }

    // 2. Extract keywords for search (Basic implementation)
    // Ideally we use an LLM or NLU to extract keywords, but for now we split space
    const keywords = messageText.toLowerCase().split(' ').filter(w => w.length > 3);
    const regexQuery = keywords.map(k => new RegExp(k, 'i'));

    // 3. Knowledge Retrieval
    // Search by text match on title/content or tags
    const knowledgeEntries = await Knowledge.find({
        status: 'active',
        $or: [
            { tags: { $in: keywords } },
            { title: { $in: regexQuery } }, // Simple regex match
            { content: { $in: regexQuery } }
        ]
    }).limit(5).lean();

    // 4. Catalog Retrieval
    // Search products by name, specs, or compatibility tags
    const catalogHits = await Product.find({
        isActive: true,
        $or: [
            { name: { $in: regexQuery } },
            { compatibilityTags: { $in: keywords } }
        ]
    }).limit(5).select('name basePrice stock specs variants compatibilityTags').lean();

    return {
        businessId,
        catalogHits,
        knowledgeEntries,
        customerProfile: customer || { psid, status: 'guest' },
        lastOrders
    };
};

export const formatContextPack = (context: RAGContext): string => {
    return JSON.stringify({
        customer: {
            name: context.customerProfile.name || 'Guest',
            language: context.customerProfile.language || 'en',
            recent_orders: context.lastOrders.map(o => ({
                id: o._id,
                status: o.status,
                total: o.total,
                date: o.createdAt
            }))
        },
        catalog_matches: context.catalogHits.map(p => ({
            name: p.name,
            price: p.basePrice,
            stock: p.stock,
            specs: p.specs,
            tags: p.compatibilityTags
        })),
        knowledge_base: context.knowledgeEntries.map(k => ({
            type: k.type,
            title: k.title,
            content: k.content
        }))
    }, null, 2);
};
