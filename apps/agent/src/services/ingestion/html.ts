import type * as cheerio from 'cheerio';

/**
 * cheerio costs about 100ms to require and is only reached while ingesting a
 * website, a product feed or an HTML product description — none of which the
 * API server touches on boot. Loading it on first parse keeps that out of every
 * dev-server restart and cold start.
 *
 * Its callers are synchronous (`extractFromHtml` and `pageContentFingerprint`
 * are exported sync functions), so this memoises a `require` rather than a
 * dynamic import, which would force the whole extraction path to go async.
 */
let cached: typeof cheerio | undefined;

export function loadHtml(html: string): cheerio.CheerioAPI {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached ||= require('cheerio') as typeof cheerio;
    return cached.load(html);
}
