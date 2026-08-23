import axios from 'axios';

export class ScraperService {
    private static readonly BASE_URL = 'https://edutechs.app';

    /**
     * Fetches the content of a page and attempts to return clean text.
     * Since we don't have cheerio/jsdom, we'll do basic cleaning of HTML tags.
     */
    static async scrapePage(path: string = ''): Promise<string> {
        try {
            const url = path.startsWith('http')
                ? path
                : `${this.BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;
            const response = await axios.get(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; EdutechsBot/1.0)',
                },
                timeout: 5000,
            });

            const html = response.data;
            if (typeof html !== 'string') {
                return 'Unable to fetch page content: Invalid response format.';
            }

            // Basic HTML to Text conversion
            let text = html
                .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, '')
                .replace(/<style\b[^>]*>([\s\S]*?)<\/style>/gim, '')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();

            // Limit length to avoid token issues
            return text.substring(0, 5000);
        } catch (error: any) {
            console.error('Scraping error:', error.message);
            return `Failed to scrape website: ${error.message}`;
        }
    }
}
