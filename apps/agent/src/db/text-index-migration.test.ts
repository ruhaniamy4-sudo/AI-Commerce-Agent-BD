import { describe, expect, it, vi } from 'vitest';
import { repairLanguageNeutralTextIndexes } from './text-index-migration';

describe('text index migration', () => {
    it('replaces only incompatible text indexes and is idempotent', async () => {
        const collections = new Map<string, any>();
        const makeCollection = (name: string, compatible: boolean) => {
            const state = {
                indexes: [{ name: '_id_', key: { _id: 1 } }, {
                    name: name === 'knowledges' ? 'legacy_knowledge_text' : `neutral_${name}`,
                    key: { _fts: 'text', _ftsx: 1 },
                    weights: { content: 1 },
                    default_language: compatible ? 'none' : 'english',
                    language_override: compatible ? '_mongoTextLanguage' : 'language',
                }],
            };
            const collection = {
                indexes: vi.fn(async () => state.indexes),
                dropIndex: vi.fn(async (indexName: string) => { state.indexes = state.indexes.filter((index) => index.name !== indexName); }),
                createIndex: vi.fn(async (_keys: unknown, options: any) => {
                    state.indexes.push({ name: options.name, key: { _fts: 'text', _ftsx: 1 }, weights: { content: 1 }, ...options });
                    return options.name;
                }),
            };
            collections.set(name, collection);
            return collection;
        };
        const knowledge = makeCollection('knowledges', false);
        makeCollection('messages', false);
        makeCollection('products', false);
        const connection = { collection: (name: string) => collections.get(name) } as any;
        vi.spyOn(console, 'log').mockImplementation(() => undefined);

        await repairLanguageNeutralTextIndexes(connection);
        await repairLanguageNeutralTextIndexes(connection);

        expect(knowledge.dropIndex).toHaveBeenCalledTimes(1);
        expect(knowledge.dropIndex).toHaveBeenCalledWith('legacy_knowledge_text');
        expect(knowledge.createIndex).toHaveBeenCalledTimes(1);
        expect(knowledge.createIndex).toHaveBeenCalledWith(
            { businessId: 1, title: 'text', content: 'text' },
            expect.objectContaining({ default_language: 'none', language_override: '_mongoTextLanguage' })
        );
    });
});
