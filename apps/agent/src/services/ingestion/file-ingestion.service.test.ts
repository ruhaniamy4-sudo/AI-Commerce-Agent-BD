import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { extractFile, validateTrainingFile } from './file-ingestion.service';
import ExcelJS from 'exceljs';

describe('business file classification', () => {
    it('extracts valid product CSV rows and skips invalid rows without failing the valid import', async () => {
        const result = await extractFile('catalog.csv', Buffer.from('name,sku,price,stock,category\nPremium Polo,POLO-1,1490,10,Shirts\nMissing price,NOPE,,2,Shirts'));
        expect(result.products).toHaveLength(2);
        expect(result.products?.[0]).toMatchObject({ name: 'Premium Polo', sku: 'POLO-1', basePrice: 1490, stock: 10 });
        expect(result.products?.[1]).toMatchObject({ name: 'Missing price', basePrice: undefined });
        expect(result.warnings?.[0]).toContain('need a price');
    });
    it('classifies a text policy as knowledge rather than a product', async () => {
        const result = await extractFile('returns.txt', Buffer.from('Return policy\n\nCustomers can request an exchange within 7 days of delivery.'));
        expect(result.products).toBeUndefined();
        expect(result.knowledge?.some((item) => item.type === 'POLICY')).toBe(true);
    });
    it('separates product blocks from policy blocks in a text document', async () => {
        const result = await extractFile('business.txt', Buffer.from('Product: Premium Polo\nPrice: Tk 1490\nSKU: POLO-1\nStock: 8\nCategory: Shirts\n\nReturn policy\nCustomers can exchange products within 7 days.'));
        expect(result.products?.[0]).toMatchObject({ name: 'Premium Polo', basePrice: 1490, sku: 'POLO-1', stock: 8 });
        expect(result.knowledge?.[0]).toMatchObject({ type: 'POLICY' });
    });
    it('rejects unsupported files', async () => {
        await expect(extractFile('malware.exe', Buffer.from('no'))).rejects.toThrow('Supported files');
    });
    it('extracts an XLSX product catalog', async () => {
        const workbook = new ExcelJS.Workbook(); const sheet = workbook.addWorksheet('Products');
        sheet.addRow(['Name', 'Price', 'Stock', 'SKU', 'Size', 'Color']); sheet.addRow(['Wireless Mouse', 850, 4, 'MOUSE-1', 'Large', 'Black']);
        const result = await extractFile('catalog.xlsx', Buffer.from(await workbook.xlsx.writeBuffer()));
        expect(result.products?.[0]).toMatchObject({ name: 'Wireless Mouse', basePrice: 850, stock: 4, sku: 'MOUSE-1' });
        expect(result.products?.[0].variants[0]).toMatchObject({ name: 'Large / Black', sku: 'MOUSE-1' });
    });
    it('extracts PDF and DOCX knowledge documents', async () => {
        const root = path.resolve(__dirname, '../../../../..');
        const pdf = fs.readFileSync(path.join(root, 'node_modules/pdf-parse/test/data/01-valid.pdf'));
        const docx = fs.readFileSync(path.join(root, 'node_modules/mammoth/test/test-data/single-paragraph.docx'));
        expect((await extractFile('policy.pdf', pdf)).knowledge?.length).toBeGreaterThan(0);
        expect((await extractFile('policy.docx', docx)).knowledge?.length).toBeGreaterThan(0);
    }, 15_000);
    it('classifies mixed spreadsheet rows into product and knowledge candidates', async () => {
        const result = await extractFile('mixed.csv', Buffer.from('name,price,sku,question,answer\nPremium Polo,1490,POLO-1,,\n,,,Do you accept returns?,Returns are accepted within seven days.'));
        expect(result.products?.[0]).toMatchObject({ name: 'Premium Polo', basePrice: 1490 });
        expect(result.knowledge?.[0]).toMatchObject({ type: 'FAQ' });
    });
    it('validates extension, MIME, content signature, and maximum size', () => {
        expect(validateTrainingFile('catalog.csv', 'text/csv', Buffer.from('name,price\nPolo,100'))).toMatchObject({ extension: '.csv' });
        expect(() => validateTrainingFile('catalog.csv', 'image/png', Buffer.from('name,price'))).toThrow('file type');
        expect(() => validateTrainingFile('fake.pdf', 'application/pdf', Buffer.from('not a pdf'))).toThrow('valid PDF');
        expect(() => validateTrainingFile('large.txt', 'text/plain', Buffer.alloc(11), 10)).toThrow('maximum size');
    });
});
