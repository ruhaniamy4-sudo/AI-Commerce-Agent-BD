import { BusinessAwareness, IBusinessAwareness } from '../models/BusinessAwareness';
import { Category } from '../models/Category';
import { Product } from '../models/Product';
import { assertTenantBusinessId, tenantDocument } from '../tenancy/context';
import { normalizedText, stableFingerprint } from './ingestion/normalization';

export function effectiveDiscount(basePrice: unknown, salePrice: unknown): number | undefined {
    const regular = Number(basePrice); const offer = Number(salePrice);
    if (!Number.isFinite(regular) || !Number.isFinite(offer) || regular <= 0 || offer < 0 || offer >= regular) return undefined;
    return Math.round((1 - offer / regular) * 10_000) / 100;
}

export function awarenessLifecycle(startsAt?: Date, endsAt?: Date, now = new Date()): 'UPCOMING'|'ACTIVE'|'EXPIRED' {
    if (endsAt && endsAt.getTime() <= now.getTime()) return 'EXPIRED';
    if (startsAt && startsAt.getTime() > now.getTime()) return 'UPCOMING';
    return 'ACTIVE';
}

interface AwarenessTargetInput { targetType: IBusinessAwareness['targetType']; targetReference?: string; claimType?: IBusinessAwareness['claimType']; claimValue?: number|string; }

export async function validateAwarenessAgainstCatalog(awareness: AwarenessTargetInput) {
    const productQuery: Record<string, any> = { isActive: true };
    if (awareness.targetType === 'CATEGORY' && awareness.targetReference) {
        const category = await Category.findOne({ name: { $regex: `^${awareness.targetReference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`, $options: 'i' } }).lean();
        if (!category) return { validation: 'UNVERIFIED' as const, note: 'No canonical category matches this campaign target' };
        productQuery.categoryId = category._id;
    } else if (awareness.targetType === 'PRODUCT' && awareness.targetReference) productQuery.name = { $regex: awareness.targetReference, $options: 'i' };
    else if (!['ALL_PRODUCTS','COLLECTION'].includes(awareness.targetType)) return { validation: 'UNVERIFIED' as const, note: 'This target cannot be validated against the Product catalog' };
    const products = await Product.find(productQuery).select('basePrice salePrice').limit(500).lean();
    if (!products.length) return { validation: 'UNVERIFIED' as const, note: 'No canonical products match this campaign target' };
    const discounts = products.map((item) => effectiveDiscount(item.basePrice, item.salePrice));
    const claim = Number(awareness.claimValue);
    if (!Number.isFinite(claim) || !['PERCENT','UP_TO_PERCENT'].includes(String(awareness.claimType))) return { validation: 'UNVERIFIED' as const, note: 'Campaign has no catalog-verifiable percentage claim' };
    if (awareness.claimType === 'UP_TO_PERCENT') return discounts.some((value) => value !== undefined && value >= claim)
        ? { validation: 'VERIFIED' as const, note: `At least one canonical product supports up to ${claim}% off` }
        : { validation: 'MISMATCH' as const, note: `No matching canonical product currently supports ${claim}% off` };
    return discounts.every((value) => value !== undefined && Math.abs(value - claim) <= .5)
        ? { validation: 'VERIFIED' as const, note: `All matching canonical products support ${claim}% off` }
        : { validation: 'MISMATCH' as const, note: `The universal ${claim}% claim is not supported by every matching canonical product` };
}

export interface ITrainingAwarenessInput extends AwarenessTargetInput { title: string; summary: string; type: IBusinessAwareness['type']; sourceType: IBusinessAwareness['sourceType']; sourceId?: string; sourceUrl?: string; publishedAt?: Date; startsAt?: Date; endsAt?: Date; confidence?: number; }

export async function upsertBusinessAwareness(businessId: string, input: ITrainingAwarenessInput) {
    assertTenantBusinessId(businessId, 'awareness.upsert');
    const fingerprint = stableFingerprint(`${input.sourceType}:${input.sourceId || input.sourceUrl || normalizedText(input.title)}`);
    const lifecycle = awarenessLifecycle(input.startsAt, input.endsAt);
    const validation = await validateAwarenessAgainstCatalog(input);
    const highRisk = Boolean(input.claimType) || input.type === 'DELIVERY_ANNOUNCEMENT';
    const status = lifecycle === 'ACTIVE' && highRisk && validation.validation !== 'VERIFIED' ? 'NEEDS_REVIEW' : lifecycle;
    if (status === 'ACTIVE') await BusinessAwareness.updateMany({ type: input.type, targetType: input.targetType, targetReference: input.targetReference, status: 'ACTIVE', fingerprint: { $ne: fingerprint } }, { $set: { status: 'SUPERSEDED' } });
    return BusinessAwareness.findOneAndUpdate({ fingerprint }, { $set: { ...input, status, validation: validation.validation, validationNote: validation.note, lastSeenAt: new Date() }, $setOnInsert: tenantDocument({ fingerprint }) }, { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true });
}

export async function retrieveRelevantAwareness(businessId: string, message: string, limit = 4) {
    assertTenantBusinessId(businessId, 'awareness.retrieve');
    const now = new Date();
    await BusinessAwareness.updateMany({ status: { $in: ['ACTIVE','UPCOMING'] }, endsAt: { $lte: now } }, { $set: { status: 'EXPIRED' } });
    const text = normalizedText(message); const offerIntent = /offer|discount|sale|campaign|price drop|অফার|ছাড়/.test(text);
    const terms = text.split(' ').filter((term) => term.length > 2).slice(0, 20);
    const or: Record<string, any>[] = terms.flatMap((term) => [{ title: { $regex: term, $options: 'i' } }, { summary: { $regex: term, $options: 'i' } }, { targetReference: { $regex: term, $options: 'i' } }]);
    const query: Record<string, any> = { status: 'ACTIVE', startsAt: { $not: { $gt: now } }, $or: or.length ? or : [{ type: { $in: offerIntent ? ['CAMPAIGN','OFFER','CATEGORY_FOCUS','COLLECTION_FOCUS'] : ['ANNOUNCEMENT','BUSINESS_UPDATE','SERVICE_HIGHLIGHT'] } }] };
    if (offerIntent) query.validation = { $ne: 'MISMATCH' };
    return BusinessAwareness.find(query).sort({ publishedAt: -1, lastSeenAt: -1 }).limit(Math.min(10, limit)).lean();
}
