import axios from 'axios';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { classifyPageUrl, extractFromHtml, fetchPublicText, knowledgeQuality, pageContentFingerprint, selectDiscoveryLinks } from './website-ingestion.service';

describe('structured website extraction', () => {
    afterEach(() => vi.restoreAllMocks());
    it('extracts JSON-LD products, business information, FAQ and policy text', () => {
        const html = `<html><head><title>Delivery Policy</title><script type="application/ld+json">${JSON.stringify({
            '@graph': [
                { '@type': 'Product', name: 'Premium Polo', description: 'Cotton polo', sku: 'POLO-1', category: 'Shirts', image: ['/polo.jpg'], offers: { price: '1490', availability: 'https://schema.org/InStock' }, additionalProperty: [{ name: 'Color', value: 'Black' }] },
                { '@type': 'LocalBusiness', name: 'Ruhan Shop', telephone: '+8801700000000', email: 'hello@example.com' },
                { '@type': 'FAQPage', mainEntity: [{ name: 'COD available?', acceptedAnswer: { text: 'Yes, cash on delivery is available.' } }] },
            ],
        })}</script></head><body><main><h1>Delivery Policy</h1><p>Inside Dhaka delivery charge is Tk 70 and delivery takes two days.</p></main></body></html>`;
        const result = extractFromHtml(html, 'https://shop.example/delivery');
        expect(result.products[0]).toMatchObject({ name: 'Premium Polo', sku: 'POLO-1', basePrice: 1490, category: 'Shirts' });
        expect(result.products[0].images[0]).toBe('https://shop.example/polo.jpg');
        expect(result.business).toMatchObject({ name: 'Ruhan Shop', phone: '+8801700000000' });
        expect(result.knowledge.some((item) => item.type === 'FAQ' && item.title === 'COD available?')).toBe(true);
        expect(result.knowledge.some((item) => item.type === 'POLICY' && item.content.includes('Tk 70'))).toBe(true);
    });

    it('handles an empty page without inventing data', () => {
        const result = extractFromHtml('<html><body></body></html>', 'https://shop.example/');
        expect(result.products).toEqual([]); expect(result.knowledge).toEqual([]); expect(result.business).toEqual({});
    });

    it('removes navigation chrome and keeps only factual policy content', () => {
        const html = `<body><header>Order Tracking Gift Blogs EMI Policy Store Location Phones ZTE Oppo Vivo Motorola</header><nav>Home Shop Cart Login Brands Categories</nav><main><h1>Delivery policy</h1><p>Inside Dhaka delivery charge is Tk 70.</p><p>Outside Dhaka delivery charge is Tk 120 and delivery takes 3 days.</p></main><footer>Home Shop Cart Login Brands Categories</footer></body>`;
        const result = extractFromHtml(html, 'https://shop.example/delivery');
        expect(result.knowledge).toHaveLength(1);
        expect(result.knowledge[0].content).toContain('Tk 70');
        expect(result.knowledge[0].content).not.toMatch(/Order Tracking|ZTE|Oppo|Cart Login/);
    });

    it('classifies useful commerce pages and rejects navigational noise', () => {
        expect(classifyPageUrl('https://shop.example/products/polo')).toBe('PRODUCT');
        expect(classifyPageUrl('https://shop.example/refund-policy')).toBe('RETURN');
        expect(classifyPageUrl('https://shop.example/shop?filter=color')).toBe('IGNORE');
        expect(knowledgeQuality('Home Shop Cart Login Brands Categories Menu Home Shop Cart Login')).not.toBe('ready');
    });

    it('extracts a relevant product gallery while excluding logos and payment icons', () => {
        const html = `<head><meta property="og:type" content="product"><meta property="og:title" content="Black Shirt"><meta property="product:price:amount" content="990"><meta property="og:image" content="/images/shirt-front.jpg"></head><body><main class="product-detail"><h1>Black Shirt</h1><div class="product-gallery"><img src="/images/shirt-front.jpg"><img data-src="/images/shirt-back.jpg"><img src="/images/payment-visa.png"><img src="/images/logo.png"></div></main></body>`;
        const product = extractFromHtml(html, 'https://shop.example/products/black-shirt').products[0];
        expect(product.images).toEqual(['https://shop.example/images/shirt-front.jpg', 'https://shop.example/images/shirt-back.jpg']);
    });

    it('fingerprints meaningful page content rather than volatile scripts', () => {
        const first = '<body><main><h1>Polo</h1><p>Price Tk 990</p></main><script>window.nonce="one"</script></body>';
        const second = '<body><main><h1>Polo</h1><p>Price Tk 990</p></main><script>window.nonce="two"</script></body>';
        const changed = '<body><main><h1>Polo</h1><p>Price Tk 1090</p></main><script>window.nonce="three"</script></body>';
        expect(pageContentFingerprint(first)).toBe(pageContentFingerprint(second));
        expect(pageContentFingerprint(first)).not.toBe(pageContentFingerprint(changed));
    });

    it('uses the crawl budget for product detail and knowledge pages before shop filters', () => {
        const links = [
            'https://shop.example/shop?sort=new',
            'https://shop.example/account/login',
            'https://shop.example/category/shirts',
            'https://shop.example/product/polo',
            'https://shop.example/product/tee',
            'https://shop.example/refund-policy',
            'https://shop.example/faq',
        ];

        expect(selectDiscoveryLinks(links, 5)).toEqual([
            'https://shop.example/product/polo',
            'https://shop.example/product/tee',
            'https://shop.example/refund-policy',
            'https://shop.example/faq',
            'https://shop.example/category/shirts',
        ]);
    });

    it('rejects a redirect from a public site to an internal target', async () => {
        vi.spyOn(axios, 'get').mockResolvedValue({ status: 302, headers: { location: 'http://127.0.0.1/admin' }, data: Buffer.alloc(0) } as any);
        await expect(fetchPublicText('https://example.com', 0, async () => [{ address: '93.184.216.34', family: 4 }])).rejects.toThrow('Private');
        expect(axios.get).toHaveBeenCalledTimes(1);
    });
});
