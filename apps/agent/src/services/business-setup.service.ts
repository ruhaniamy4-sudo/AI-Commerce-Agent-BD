import { Business } from '../models/Business';
import { Knowledge } from '../models/Knowledge';
import { assertTenantBusinessId, tenantDocument } from '../tenancy/context';
import { BusinessType, getBusinessSetupQuestions, normalizeBusinessType } from './adaptive-training.service';
import { knowledgeFact, stableFingerprint } from './ingestion/normalization';

export type SetupFactValue = string | string[];

export function setupQuestionStorageKey(type: BusinessType, questionKey: string) {
    return `${type}:${questionKey}`;
}

export function setupQuestionBaseKey(type: BusinessType, storedKey: string) {
    const prefix = `${type}:`;
    return storedKey.startsWith(prefix) ? storedKey.slice(prefix.length) : storedKey;
}

export async function listConfirmedSetupAnswers(businessId: string, typeValue: unknown) {
    assertTenantBusinessId(businessId, 'business-setup.list');
    const type = normalizeBusinessType(typeValue);
    if (!type) return {};
    const facts = await Knowledge.find({ businessId, status: 'active', merchantConfirmed: true, factSource: 'BUSINESS_SETUP', setupQuestionKey: { $type: 'string' } })
        .select('businessType setupQuestionKey structuredValue content updatedAt')
        .sort({ updatedAt: -1 })
        .limit(250)
        .lean();
    const answers: Record<string, { value: SetupFactValue; updatedAt: Date }> = {};
    for (const fact of facts) {
        const storedKey = String(fact.setupQuestionKey || '');
        const scoped = storedKey.startsWith(`${type}:`);
        const legacyForType = !storedKey.includes(':') && fact.businessType === type;
        if (!scoped && !legacyForType) continue;
        const key = setupQuestionBaseKey(type, storedKey);
        if (!answers[key] || scoped) answers[key] = { value: (fact.structuredValue ?? fact.content) as SetupFactValue, updatedAt: fact.updatedAt };
    }
    return answers;
}

export async function saveConfirmedSetupAnswer(params: {
    businessId: string;
    userId: string;
    questionKey: string;
    value: unknown;
    merchantConfirmed: boolean;
}) {
    const businessId = assertTenantBusinessId(params.businessId, 'business-setup.save');
    if (params.merchantConfirmed !== true) throw new Error('Confirm this answer before saving');
    const business = await Business.findById(businessId).select('businessType businessTypeStatus').lean();
    const type = normalizeBusinessType(business?.businessType);
    const question = getBusinessSetupQuestions(type).find((item) => item.id === params.questionKey);
    if (!type || !question || business?.businessTypeStatus !== 'confirmed') throw new Error('This question does not apply to the confirmed business type');
    const value = Array.isArray(params.value)
        ? [...new Set(params.value.map((item) => String(item).trim()).filter(Boolean))].slice(0, 30)
        : String(params.value ?? '').replace(/\s+/g, ' ').trim();
    if ((Array.isArray(value) && !value.length) || (!Array.isArray(value) && !value)) throw new Error('Choose or enter an answer before saving');
    const content = Array.isArray(value) ? value.join(', ') : value;
    if (content.length > 8_000) throw new Error('Please keep this answer under 8,000 characters');
    const storageKey = setupQuestionStorageKey(type, question.id);
    const fingerprint = stableFingerprint(`business-setup:${storageKey}`);
    const now = new Date();
    const fact = await Knowledge.findOneAndUpdate(
        { businessId, setupQuestionKey: storageKey },
        {
            $set: {
                title: question.question,
                content,
                type: question.domain === 'RETURN' || question.domain === 'REFUND' || question.domain === 'POLICY' ? 'POLICY' : 'GUIDE',
                language: 'en',
                tags: [question.id, question.domain.toLowerCase()],
                status: 'active',
                sourcePriority: 'high',
                updatedBy: params.userId,
                isPinned: true,
                normalizedFact: knowledgeFact(content),
                fingerprint,
                merchantConfirmed: true,
                businessType: type,
                knowledgeDomain: question.domain,
                setupQuestionKey: storageKey,
                structuredValue: value,
                factSource: 'BUSINESS_SETUP',
                provenance: [{ sourceType: 'manual', sourceExternalId: question.id, fingerprint, lastSeenAt: now, lastSyncedAt: now }],
            },
            $setOnInsert: tenantDocument({ createdBy: params.userId, versionHistory: [] }),
        },
        { upsert: true, new: true, runValidators: true, setDefaultsOnInsert: true }
    );
    return { key: question.id, value: fact.structuredValue as SetupFactValue, updatedAt: fact.updatedAt, businessType: type, merchantConfirmed: true as const, source: 'BUSINESS_SETUP' as const };
}
