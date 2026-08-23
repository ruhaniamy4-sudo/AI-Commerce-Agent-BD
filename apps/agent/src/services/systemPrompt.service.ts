import NodeCache from 'node-cache';
import { SystemPrompt } from '../models/SystemPrompt';

// Cache with no TTL - will be manually invalidated
const promptCache = new NodeCache();
const CACHE_KEY = 'active_system_prompt';

/**
 * Get the active system prompt from cache or database
 * Returns null if no active prompt exists
 */
export async function getActiveSystemPrompt(): Promise<string | null> {
    try {
        // Check cache first
        const cached = promptCache.get<string>(CACHE_KEY);
        if (cached !== undefined) {
            console.log('System prompt cache hit');
            return cached;
        }

        console.log('System prompt cache miss - fetching from DB');

        // Cache miss - fetch from database
        const activePrompt = await SystemPrompt.findOne({ isActive: true })
            .sort({ updatedAt: -1 })
            .lean();

        if (activePrompt) {
            // Store in cache
            promptCache.set(CACHE_KEY, activePrompt.content);
            return activePrompt.content;
        }

        // No active prompt found - cache null to avoid repeated DB queries
        promptCache.set(CACHE_KEY, null);
        return null;
    } catch (error) {
        console.error('Error fetching active system prompt:', error);
        return null;
    }
}

/**
 * Invalidate the system prompt cache
 * Call this whenever a system prompt is created, updated, or deleted
 */
export function invalidatePromptCache(): void {
    promptCache.del(CACHE_KEY);
    console.log('System prompt cache invalidated');
}

/**
 * Warm the cache by pre-loading the active system prompt
 * Should be called on server startup
 */
export async function warmPromptCache(): Promise<void> {
    try {
        console.log('Warming system prompt cache...');
        const prompt = await getActiveSystemPrompt();
        if (prompt) {
            console.log('System prompt cache warmed successfully');
        } else {
            console.log('No active system prompt found - will use default');
        }
    } catch (error) {
        console.error('Error warming system prompt cache:', error);
    }
}

/**
 * Set a specific prompt as active and invalidate cache
 */
export async function setActivePrompt(promptId: string): Promise<void> {
    try {
        // Deactivate all prompts
        await SystemPrompt.updateMany({}, { isActive: false });

        // Activate the specified prompt
        await SystemPrompt.findByIdAndUpdate(promptId, { isActive: true });

        // Invalidate cache
        invalidatePromptCache();
    } catch (error) {
        console.error('Error setting active prompt:', error);
        throw error;
    }
}
