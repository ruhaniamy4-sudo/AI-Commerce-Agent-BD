import path from 'node:path';
import ExcelJS from 'exceljs';

export const MAX_PRODUCT_IMPORT_BYTES = 5_000_000;
export const MAX_PRODUCT_IMPORT_ROWS = 1_000;
export const REQUIRED_PRODUCT_IMPORT_COLUMNS = ['name', 'description', 'category', 'price'] as const;

export class ProductImportError extends Error {
    constructor(message: string, public readonly rowErrors: ProductImportRowError[] = []) {
        super(message);
        this.name = 'ProductImportError';
    }
}

export interface ProductImportRowError {
    row: number;
    errors: string[];
}

export interface ParsedProductImport {
    row: number;
    name: string;
    description: string;
    category: string;
    basePrice: number;
    currency: string;
    stock: number | null;
    salePrice?: number;
    brand?: string;
    barcode?: string;
    images: string[];
    specs: Record<string, string>;
    compatibilityTags: string[];
    isActive: boolean;
    isFeatured: boolean;
    isReturnable: boolean;
    warrantyMonths: number;
    lowStockThreshold: number;
    variant?: {
        name: string;
        sku: string;
        price: number;
        currency: string;
        stock: number | null;
        images: string[];
        specs: Record<string, string>;
        isActive: boolean;
    };
}

type RawRow = { row: number; values: Record<string, unknown> };

const COLUMN_ALIASES: Record<string, string[]> = {
    name: ['name', 'product', 'product name', 'title'],
    description: ['description', 'details', 'product description'],
    category: ['category', 'category name'],
    price: ['price', 'base price', 'regular price'],
    currency: ['currency', 'currency code'],
    stock: ['stock', 'quantity', 'qty'],
    salePrice: ['sale price', 'discount price'],
    sku: ['sku', 'product sku'],
    variant: ['variant', 'variant name'],
    brand: ['brand'],
    barcode: ['barcode', 'gtin'],
    images: ['images', 'image urls', 'image url'],
    specs: ['specs', 'specifications'],
    tags: ['tags', 'compatibility tags'],
    isActive: ['active', 'is active'],
    isFeatured: ['featured', 'is featured'],
    isReturnable: ['returnable', 'is returnable'],
    warrantyMonths: ['warranty months', 'warranty'],
    lowStockThreshold: ['low stock threshold'],
};

function normalizeHeader(value: unknown) {
    return String(value ?? '').trim().toLowerCase().replace(/[_-]+/g, ' ').replace(/\s+/g, ' ');
}

function getValue(row: Record<string, unknown>, key: keyof typeof COLUMN_ALIASES) {
    const aliases = COLUMN_ALIASES[key];
    const match = Object.entries(row).find(([header]) => aliases.includes(normalizeHeader(header)));
    return match?.[1];
}

function cellValue(value: ExcelJS.CellValue): unknown {
    if (value && typeof value === 'object') {
        if ('result' in value) return value.result;
        if ('text' in value) return value.text;
        if ('richText' in value) return value.richText.map((part) => part.text).join('');
    }
    return value ?? '';
}

function parseCsv(text: string): RawRow[] {
    const records: string[][] = [];
    let currentRow: string[] = [];
    let currentValue = '';
    let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === '"' && quoted && text[index + 1] === '"') { currentValue += '"'; index += 1; }
        else if (character === '"') quoted = !quoted;
        else if (character === ',' && !quoted) { currentRow.push(currentValue); currentValue = ''; }
        else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && text[index + 1] === '\n') index += 1;
            currentRow.push(currentValue);
            records.push(currentRow);
            currentRow = [];
            currentValue = '';
        } else currentValue += character;
    }
    if (quoted) throw new ProductImportError('The CSV contains an unclosed quoted value');
    currentRow.push(currentValue);
    records.push(currentRow);
    const nonEmpty = records.filter((record) => record.some((value) => value.trim()));
    const headers = (nonEmpty.shift() || []).map((header) => header.replace(/^\uFEFF/, '').trim());
    return nonEmpty.map((record, index) => ({
        row: index + 2,
        values: Object.fromEntries(headers.map((header, column) => [header, record[column] ?? ''])),
    }));
}

async function parseWorkbook(buffer: Buffer): Promise<RawRow[]> {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as any);
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const headers: string[] = [];
    sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => { headers[column - 1] = String(cellValue(cell.value)).trim(); });
    const rows: RawRow[] = [];
    sheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) return;
        const values = Object.fromEntries(headers.filter(Boolean).map((header, index) => [header, cellValue(row.getCell(index + 1).value)]));
        if (Object.values(values).some((value) => String(value ?? '').trim())) rows.push({ row: rowNumber, values });
    });
    return rows;
}

function parseNumber(value: unknown, field: string, errors: string[], options: { required?: boolean; integer?: boolean; fallback?: number | null } = {}) {
    const text = String(value ?? '').trim().replace(/,/g, '');
    if (!text) {
        if (options.required) errors.push(`${field} is required`);
        return options.fallback;
    }
    const parsed = Number(text);
    if (!Number.isFinite(parsed) || parsed < 0 || (options.integer && !Number.isInteger(parsed))) {
        errors.push(`${field} must be a non-negative${options.integer ? ' whole' : ''} number`);
        return options.fallback;
    }
    return parsed;
}

function parseBoolean(value: unknown, field: string, fallback: boolean, errors: string[]) {
    const text = String(value ?? '').trim().toLowerCase();
    if (!text) return fallback;
    if (['true', 'yes', '1'].includes(text)) return true;
    if (['false', 'no', '0'].includes(text)) return false;
    errors.push(`${field} must be true/false, yes/no, or 1/0`);
    return fallback;
}

function parseSpecs(value: unknown, errors: string[]) {
    const text = String(value ?? '').trim();
    if (!text) return {};
    if (text.startsWith('{')) {
        try {
            const parsed = JSON.parse(text);
            if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error();
            return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key.trim(), String(entry)]).filter(([key]) => key));
        } catch { errors.push('specs must be JSON or key=value pairs separated by semicolons'); return {}; }
    }
    const pairs = text.split(';').map((part) => part.trim()).filter(Boolean);
    const result: Record<string, string> = {};
    for (const pair of pairs) {
        const separator = pair.includes('=') ? '=' : ':';
        const index = pair.indexOf(separator);
        if (index <= 0 || !pair.slice(index + 1).trim()) { errors.push('specs must be JSON or key=value pairs separated by semicolons'); return {}; }
        result[pair.slice(0, index).trim()] = pair.slice(index + 1).trim();
    }
    return result;
}

function assertRequiredHeaders(rows: RawRow[]) {
    if (!rows.length) throw new ProductImportError('The file has no product rows');
    const headers = Object.keys(rows[0].values).map(normalizeHeader);
    const missing = REQUIRED_PRODUCT_IMPORT_COLUMNS.filter((column) => !COLUMN_ALIASES[column].some((alias) => headers.includes(alias)));
    if (missing.length) throw new ProductImportError(`Missing required column${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
}

export async function parseProductImportFile(filename: string, mimeType: string, buffer: Buffer): Promise<ParsedProductImport[]> {
    const safeName = path.basename(filename || '');
    const extension = path.extname(safeName).toLowerCase();
    if (!['.csv', '.xlsx'].includes(extension)) throw new ProductImportError('Choose a CSV or XLSX file');
    if (!buffer.length) throw new ProductImportError('The selected file is empty');
    if (buffer.length > MAX_PRODUCT_IMPORT_BYTES) throw new ProductImportError('File is too large. Maximum size is 5 MB.');
    if (extension === '.xlsx' && buffer.subarray(0, 2).toString('ascii') !== 'PK') throw new ProductImportError('The selected XLSX file is invalid');
    if (extension === '.csv') {
        if (buffer.includes(0)) throw new ProductImportError('The selected CSV contains unsupported binary data');
        const normalizedMime = String(mimeType || '').toLowerCase().split(';')[0];
        if (normalizedMime && !['text/csv', 'text/plain', 'application/csv', 'application/vnd.ms-excel', 'application/octet-stream'].includes(normalizedMime)) throw new ProductImportError('The file type does not match a CSV upload');
    }

    let rows: RawRow[];
    try {
        rows = extension === '.csv'
            ? parseCsv(new TextDecoder('utf-8', { fatal: true }).decode(buffer))
            : await parseWorkbook(buffer);
    } catch (error) {
        if (error instanceof ProductImportError) throw error;
        throw new ProductImportError(`We couldn't read this ${extension.slice(1).toUpperCase()} file`);
    }
    assertRequiredHeaders(rows);
    if (rows.length > MAX_PRODUCT_IMPORT_ROWS) throw new ProductImportError(`A file can contain at most ${MAX_PRODUCT_IMPORT_ROWS} products`);

    const rowErrors: ProductImportRowError[] = [];
    const skuRows = new Map<string, number>();
    const products = rows.map(({ row, values }) => {
        const errors: string[] = [];
        const name = String(getValue(values, 'name') ?? '').trim();
        const description = String(getValue(values, 'description') ?? '').trim();
        const category = String(getValue(values, 'category') ?? '').trim();
        if (!name) errors.push('name is required');
        if (!description) errors.push('description is required');
        if (!category) errors.push('category is required');
        const basePrice = parseNumber(getValue(values, 'price'), 'price', errors, { required: true, fallback: 0 }) ?? 0;
        const stock = parseNumber(getValue(values, 'stock'), 'stock', errors, { integer: true, fallback: null }) ?? null;
        const salePrice = parseNumber(getValue(values, 'salePrice'), 'sale price', errors);
        if (salePrice !== undefined && salePrice !== null && salePrice > basePrice) errors.push('sale price cannot be greater than price');
        const warrantyMonths = parseNumber(getValue(values, 'warrantyMonths'), 'warranty months', errors, { integer: true, fallback: 0 }) ?? 0;
        const lowStockThreshold = parseNumber(getValue(values, 'lowStockThreshold'), 'low stock threshold', errors, { integer: true, fallback: 5 }) ?? 5;
        const currency = String(getValue(values, 'currency') ?? 'BDT').trim().toUpperCase() || 'BDT';
        if (!/^[A-Z]{3}$/.test(currency)) errors.push('currency must be a 3-letter code such as BDT or USD');
        const specs = parseSpecs(getValue(values, 'specs'), errors);
        const images = String(getValue(values, 'images') ?? '').split(/[|;]/).map((item) => item.trim()).filter(Boolean);
        for (const image of images) {
            try { const url = new URL(image); if (!['http:', 'https:'].includes(url.protocol)) throw new Error(); }
            catch { errors.push(`image URL is invalid: ${image}`); }
        }
        const sku = String(getValue(values, 'sku') ?? '').trim();
        if (sku) {
            const normalizedSku = sku.toLowerCase();
            if (skuRows.has(normalizedSku)) errors.push(`SKU duplicates row ${skuRows.get(normalizedSku)}`);
            else skuRows.set(normalizedSku, row);
        }
        const variantName = String(getValue(values, 'variant') ?? '').trim();
        const isActive = parseBoolean(getValue(values, 'isActive'), 'active', true, errors);
        const product: ParsedProductImport = {
            row, name, description, category, basePrice, currency, stock,
            ...(salePrice !== undefined && salePrice !== null ? { salePrice } : {}),
            brand: String(getValue(values, 'brand') ?? '').trim() || undefined,
            barcode: String(getValue(values, 'barcode') ?? '').trim() || undefined,
            images, specs,
            compatibilityTags: String(getValue(values, 'tags') ?? '').split(/[|;,]/).map((item) => item.trim()).filter(Boolean),
            isActive,
            isFeatured: parseBoolean(getValue(values, 'isFeatured'), 'featured', false, errors),
            isReturnable: parseBoolean(getValue(values, 'isReturnable'), 'returnable', true, errors),
            warrantyMonths,
            lowStockThreshold,
            ...(sku ? { variant: { name: variantName || 'Default', sku, price: basePrice, currency, stock, images, specs, isActive } } : {}),
        };
        if (errors.length) rowErrors.push({ row, errors });
        return product;
    });
    if (rowErrors.length) throw new ProductImportError('Some rows need correction before anything can be imported', rowErrors);
    return products;
}

export function productSlug(value: string, fallback: string) {
    return value.normalize('NFKD').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '').slice(0, 100) || fallback;
}
