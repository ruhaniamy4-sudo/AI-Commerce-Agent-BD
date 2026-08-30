import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { FacebookPermissionError, importAuthorizedFacebookPage } from './facebook-ingestion.service';

describe('authorized Facebook business ingestion', () => {
    afterEach(() => { vi.restoreAllMocks(); delete process.env.FB_PAGE_ACCESS_TOKEN; });
    it('fails gracefully when Meta permission is not configured', async () => {
        await expect(importAuthorizedFacebookPage('page-1')).rejects.toBeInstanceOf(FacebookPermissionError);
    });
    it('extracts only officially returned authorized Page data', async () => {
        process.env.FB_PAGE_ACCESS_TOKEN = 'test-token';
        vi.spyOn(axios, 'get').mockResolvedValue({ data: { id: 'page-1', name: 'Ruhan Shop', about: 'Bangladeshi fashion store', phone: '+8801700000000', emails: ['hello@example.com'] } });
        const result = await importAuthorizedFacebookPage('page-1');
        expect(result.business).toMatchObject({ name: 'Ruhan Shop', phone: '+8801700000000', email: 'hello@example.com' });
        expect(result.knowledge).toHaveLength(1); expect(result.products).toEqual([]);
    });
    it('reports expired or unavailable permission without fabricating data', async () => {
        process.env.FB_PAGE_ACCESS_TOKEN = 'expired-token';
        vi.spyOn(axios, 'get').mockRejectedValue({ response: { status: 403, data: { error: { code: 190 } } } });
        await expect(importAuthorizedFacebookPage('page-1')).rejects.toThrow('expired');
    });
});
