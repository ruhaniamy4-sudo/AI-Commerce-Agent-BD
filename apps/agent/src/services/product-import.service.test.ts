import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';
import { parseProductImportFile, ProductImportError, productSlug } from './product-import.service';

describe('product catalog import', () => {
    it('parses a valid CSV with required and optional product data', async () => {
        const file = Buffer.from('name,description,category,price,currency,stock,sku,variant,specs\nPremium Polo,Combed cotton polo,Shirts,1490,BDT,8,POLO-1,Black / L,"color=Black;size=L"');
        const result = await parseProductImportFile('catalog.csv', 'text/csv', file);
        expect(result).toHaveLength(1);
        expect(result[0]).toMatchObject({ name: 'Premium Polo', description: 'Combed cotton polo', category: 'Shirts', basePrice: 1490, currency: 'BDT', stock: 8 });
        expect(result[0].variant).toMatchObject({ name: 'Black / L', sku: 'POLO-1', price: 1490, stock: 8 });
        expect(result[0].specs).toEqual({ color: 'Black', size: 'L' });
    });

    it('rejects files without every required column', async () => {
        await expect(parseProductImportFile('catalog.csv', 'text/csv', Buffer.from('name,category,price\nPolo,Shirts,1000')))
            .rejects.toThrow('Missing required column: description');
    });

    it('reports every invalid row before import', async () => {
        const file = Buffer.from('name,description,category,price,stock\n,Missing a name,Shirts,1000,2\nBroken price,Description,Shirts,nope,-1');
        try {
            await parseProductImportFile('catalog.csv', 'text/csv', file);
            throw new Error('Expected import validation to fail');
        } catch (error) {
            expect(error).toBeInstanceOf(ProductImportError);
            expect((error as ProductImportError).rowErrors).toEqual([
                { row: 2, errors: ['name is required'] },
                { row: 3, errors: ['price must be a non-negative number', 'stock must be a non-negative whole number'] },
            ]);
        }
    });

    it('parses the first worksheet of an XLSX catalog', async () => {
        const workbook = new ExcelJS.Workbook();
        const sheet = workbook.addWorksheet('Products');
        sheet.addRow(['Name', 'Description', 'Category', 'Price']);
        sheet.addRow(['Wireless Mouse', 'Silent wireless mouse', 'Electronics', 850]);
        const buffer = Buffer.from(await workbook.xlsx.writeBuffer());
        const result = await parseProductImportFile('catalog.xlsx', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer);
        expect(result[0]).toMatchObject({ name: 'Wireless Mouse', basePrice: 850, category: 'Electronics' });
    });

    it('creates safe slugs and has a fallback for non-latin product names', () => {
        expect(productSlug('Premium Polo Shirt', 'fallback')).toBe('premium-polo-shirt');
        expect(productSlug('বাংলা পণ্য', 'product-2')).toBe('product-2');
    });
});
