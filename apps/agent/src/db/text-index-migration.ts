import type { Connection } from 'mongoose';

interface TextIndexDefinition {
    collection: string;
    name: string;
    keys: Record<string, 1 | 'text'>;
}

const textIndexes: TextIndexDefinition[] = [
    {
        collection: 'knowledges',
        name: 'businessId_1_title_text_content_text',
        keys: { businessId: 1, title: 'text', content: 'text' },
    },
    {
        collection: 'messages',
        name: 'businessId_1_content_text',
        keys: { businessId: 1, content: 'text' },
    },
    {
        collection: 'products',
        name: 'businessId_1_name_text_description_text',
        keys: { businessId: 1, name: 'text', description: 'text' },
    },
];

export async function repairLanguageNeutralTextIndexes(connection: Connection) {
    for (const definition of textIndexes) {
        const collection = connection.collection(definition.collection);
        let indexes: Awaited<ReturnType<typeof collection.indexes>> = [];
        try {
            indexes = await collection.indexes();
        } catch (error: any) {
            if (error?.code !== 26 && error?.codeName !== 'NamespaceNotFound') throw error;
            indexes = [];
        }
        const existingTextIndex = indexes.find((index: any) => index.key?._fts === 'text' || index.weights);
        const compatible = existingTextIndex?.name === definition.name
            && existingTextIndex.default_language === 'none'
            && existingTextIndex.language_override === '_mongoTextLanguage';

        if (compatible) {
            console.log(`${definition.collection}: text index already language-neutral`);
            continue;
        }
        if (existingTextIndex?.name) {
            await collection.dropIndex(existingTextIndex.name);
            console.log(`${definition.collection}: dropped incompatible text index ${existingTextIndex.name}`);
        }
        await collection.createIndex(definition.keys, {
            name: definition.name,
            default_language: 'none',
            language_override: '_mongoTextLanguage',
        });
        console.log(`${definition.collection}: created language-neutral text index`);
    }
}
