import path from 'node:path';
import mammoth from 'mammoth';
import ExcelJS from 'exceljs';
import { CandidateInput } from './business-ingestion.service';
import { normalizeMoney } from './normalization';

const MAX_TEXT = 200_000;
export const DEFAULT_MAX_TRAINING_FILE_BYTES = 10_000_000;
// The package root executes its bundled demo under some test runners; the library entry is side-effect free.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const pdf: (buffer: Buffer) => Promise<{ text: string }> = require('pdf-parse/lib/pdf-parse.js');
const PRODUCT_COLUMNS = ['product', 'sku', 'price', 'stock', 'category', 'barcode', 'size', 'color', 'variant'];
const KNOWLEDGE_COLUMNS = ['question', 'answer', 'policy', 'content', 'faq', 'information', 'topic'];
const SUPPORTED_EXTENSIONS = ['.pdf', '.docx', '.txt', '.csv', '.xlsx'];
const ALLOWED_MIME_TYPES: Record<string, string[]> = {
    '.pdf': ['application/pdf', 'application/octet-stream'],
    '.docx': ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/zip', 'application/octet-stream'],
    '.txt': ['text/plain', 'application/octet-stream'],
    '.csv': ['text/csv', 'text/plain', 'application/vnd.ms-excel', 'application/csv', 'application/octet-stream'],
    '.xlsx': ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/zip', 'application/octet-stream'],
};

export class FileIngestionError extends Error {
    constructor(message: string) { super(message); this.name = 'FileIngestionError'; }
}

export function validateTrainingFile(filename: string, mimeType: string, buffer: Buffer, maxBytes = DEFAULT_MAX_TRAINING_FILE_BYTES) {
    const safeName = path.basename(filename || '');
    const extension = path.extname(safeName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) throw new FileIngestionError('Supported files are PDF, DOCX, TXT, CSV, and XLSX');
    if (!buffer.length) throw new FileIngestionError('The selected file is empty');
    if (buffer.length > maxBytes) throw new FileIngestionError(`File is too large. The maximum size is ${Math.floor(maxBytes / 1_000_000)} MB.`);
    const normalizedMime = String(mimeType || '').toLowerCase().split(';')[0].trim();
    if (!ALLOWED_MIME_TYPES[extension].includes(normalizedMime)) throw new FileIngestionError(`The file type does not match a supported ${extension.slice(1).toUpperCase()} upload`);
    if (extension === '.pdf' && buffer.subarray(0, 5).toString('ascii') !== '%PDF-') throw new FileIngestionError('The selected PDF is not a valid PDF file');
    if (['.docx', '.xlsx'].includes(extension) && buffer.subarray(0, 2).toString('ascii') !== 'PK') throw new FileIngestionError(`The selected ${extension.slice(1).toUpperCase()} file is invalid`);
    if (['.txt', '.csv'].includes(extension)) {
        if (buffer.includes(0)) throw new FileIngestionError('The selected text file contains unsupported binary data');
        try { new TextDecoder('utf-8', { fatal: true }).decode(buffer); }
        catch { throw new FileIngestionError('Text and CSV files must use UTF-8 encoding'); }
    }
    return { filename: safeName, extension };
}

function rowValue(row: Record<string, unknown>, ...names: string[]) {
    const entry = Object.entries(row).find(([key]) => names.includes(key.trim().toLowerCase()));
    return entry?.[1];
}
function rowHasValue(row: Record<string, unknown>, ...names: string[]) {
    return Object.entries(row).some(([key, value]) => names.includes(key.trim().toLowerCase()) && String(value ?? '').trim().length > 0);
}
function productsFromRows(rows: Record<string, unknown>[]) {
    let skipped = 0; let needsAttention = 0;
    const products = rows.map((row) => {
        const name = String(rowValue(row, 'name', 'product', 'product name', 'title') || '').trim();
        const price = normalizeMoney(rowValue(row, 'price', 'regular price', 'base price'));
        if (!name) { skipped += 1; return null; }
        if (price === undefined) needsAttention += 1;
        const sku = String(rowValue(row, 'sku', 'product sku') || '').trim() || undefined;
        const stockValue = Number(rowValue(row, 'stock', 'quantity', 'qty'));
        const size = String(rowValue(row, 'size') || '').trim() || undefined;
        const color = String(rowValue(row, 'color', 'colour') || '').trim() || undefined;
        const variantName = String(rowValue(row, 'variant', 'variant name') || [size, color].filter(Boolean).join(' / ')).trim() || undefined;
        const stock = Number.isFinite(stockValue) && stockValue >= 0 ? stockValue : 0;
        return {
            name, description: String(rowValue(row, 'description', 'details') || name), category: String(rowValue(row, 'category') || 'Imported'),
            basePrice: price, salePrice: normalizeMoney(rowValue(row, 'sale price', 'discount price')), sku,
            barcode: String(rowValue(row, 'barcode', 'gtin') || '').trim() || undefined,
            stock, images: [], variants: variantName ? [{ name: variantName, sku, price, stock, images: [], specs: { ...(size ? { size } : {}), ...(color ? { color } : {}) } }] : [],
            specs: { ...(size ? { size } : {}), ...(color ? { color } : {}) },
        };
    }).filter(Boolean) as any[];
    return { products, skipped, needsAttention };
}

function knowledgeFromRows(rows: Record<string, unknown>[], sourceName: string) {
    return rows.flatMap((row, index) => {
        const answer = String(rowValue(row, 'answer', 'content', 'policy', 'information', 'details') || '').trim();
        const question = String(rowValue(row, 'question', 'faq') || '').trim();
        if (!answer && !question) return [];
        const title = String(rowValue(row, 'topic', 'title') || question || `${sourceName} item ${index + 1}`).trim();
        const content = question && answer ? `${question}\n${answer}` : answer || question;
        return [{ title: title.slice(0, 200), content, type: question ? 'FAQ' as const : /return|refund|delivery|shipping|payment|warranty|policy|exchange/i.test(`${title} ${content}`) ? 'POLICY' as const : 'GUIDE' as const, sourceUrl: `file://${sourceName}` }];
    });
}
function csvRows(text: string): Record<string, unknown>[] {
    const records: string[][] = []; let row: string[] = []; let value = ''; let quoted = false;
    for (let index = 0; index < text.length; index += 1) {
        const character = text[index];
        if (character === '"' && quoted && text[index + 1] === '"') { value += '"'; index += 1; }
        else if (character === '"') quoted = !quoted;
        else if (character === ',' && !quoted) { row.push(value); value = ''; }
        else if ((character === '\n' || character === '\r') && !quoted) {
            if (character === '\r' && text[index + 1] === '\n') index += 1;
            row.push(value); if (row.some((cell) => cell.trim())) records.push(row); row = []; value = '';
        } else value += character;
    }
    row.push(value); if (row.some((cell) => cell.trim())) records.push(row);
    const headers = (records.shift() || []).map((header) => header.trim());
    return records.map((record) => Object.fromEntries(headers.map((header, index) => [header, record[index] ?? ''])));
}
function cellValue(value: ExcelJS.CellValue): unknown {
    if (value && typeof value === 'object') {
        if ('result' in value) return value.result;
        if ('text' in value) return value.text;
        if ('richText' in value) return value.richText.map((part) => part.text).join('');
    }
    return value ?? '';
}
async function workbookRows(buffer: Buffer): Promise<Record<string, unknown>[]> {
    const workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer as any);
    const result: Record<string, unknown>[] = [];
    workbook.eachSheet((sheet) => {
        const headers: string[] = [];
        sheet.getRow(1).eachCell({ includeEmpty: true }, (cell, column) => { headers[column - 1] = String(cellValue(cell.value)).trim(); });
        sheet.eachRow((row, rowNumber) => {
            if (rowNumber === 1) return;
            const record: Record<string, unknown> = {};
            headers.forEach((header, index) => { if (header) record[header] = cellValue(row.getCell(index + 1).value); });
            if (Object.values(record).some((entry) => String(entry).trim())) result.push(record);
        });
    });
    return result;
}
function knowledgeFromText(text: string, sourceName: string) {
    const clean = text.replace(/\0/g, '').replace(/[ \t]+/g, ' ').trim().slice(0, MAX_TEXT);
    if (!clean) return [];
    const sections = clean.split(/\n\s*\n+/).map((part) => part.trim()).filter((part) => part.length >= 20).slice(0, 50);
    return sections.map((content, index) => ({
        title: (content.split(/\r?\n/)[0] || `${sourceName} section ${index + 1}`).slice(0, 200),
        content, type: /return|refund|delivery|shipping|payment|warranty|policy|exchange/i.test(content) ? 'POLICY' as const : /\?|faq/i.test(content) ? 'FAQ' as const : 'GUIDE' as const,
        sourceUrl: `file://${sourceName}`,
    }));
}
function classifyTextDocument(text: string, sourceName: string): CandidateInput {
    const sections = text.replace(/\0/g, '').split(/\n\s*\n+/).map((part) => part.trim()).filter(Boolean).slice(0, 500);
    const products: any[] = []; const knowledgeSections: string[] = [];
    for (const section of sections) {
        const field = (name: string) => section.match(new RegExp(`(?:^|\\n)\\s*${name}\\s*[:=-]\\s*([^\\n]+)`, 'i'))?.[1]?.trim();
        const price = normalizeMoney(field('(?:regular\\s+)?price') || section.match(/(?:৳|tk\.?|bdt)\s*([0-9,.]+)/i)?.[1]);
        const explicitName = field('(?:product(?:\\s+name)?|name|title)');
        const looksLikeProduct = price !== undefined && Boolean(explicitName || /\bsku\s*[:=-]/i.test(section));
        if (looksLikeProduct) {
            const name = explicitName || section.split(/\r?\n/)[0].replace(/(?:৳|tk\.?|bdt).*$/i, '').trim();
            const stock = Number(field('(?:stock|quantity|qty)'));
            products.push({ name, description: field('description') || section.slice(0, 5000), category: field('category') || 'Imported', basePrice: price,
                salePrice: normalizeMoney(field('(?:sale|discount)\\s+price')), sku: field('sku'), barcode: field('(?:barcode|gtin)'),
                stock: Number.isFinite(stock) && stock >= 0 ? stock : 0, images: [], variants: [], specs: {},
            });
        } else knowledgeSections.push(section);
    }
    const business: Record<string, string> = {};
    const email = text.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/)?.[0];
    const phone = text.match(/(?:\+?88)?01[3-9]\d{8}/)?.[0];
    if (email) business.email = email;
    if (phone) business.phone = phone;
    return { products: products.length ? products : undefined, knowledge: knowledgeFromText(knowledgeSections.join('\n\n'), sourceName), business: Object.keys(business).length ? business : undefined };
}

export async function extractFile(filename: string, buffer: Buffer): Promise<CandidateInput> {
    const safeName = path.basename(filename);
    const extension = path.extname(safeName).toLowerCase();
    if (!SUPPORTED_EXTENSIONS.includes(extension)) throw new FileIngestionError('Supported files are PDF, DOCX, TXT, CSV, and XLSX');
    try {
        if (extension === '.csv' || extension === '.xlsx') {
            const rows = extension === '.csv' ? csvRows(buffer.toString('utf8').replace(/^\uFEFF/, '')) : await workbookRows(buffer);
            if (!rows.length) throw new FileIngestionError('The catalog file has no data rows');
            const headerNames = Object.keys(rows[0]).map((key) => key.toLowerCase());
            const hasProducts = headerNames.some((name) => PRODUCT_COLUMNS.some((column) => name.includes(column)));
            const hasKnowledge = headerNames.some((name) => KNOWLEDGE_COLUMNS.some((column) => name.includes(column)));
            if (!hasProducts) {
                const knowledge = hasKnowledge ? knowledgeFromRows(rows, safeName) : knowledgeFromText(rows.map((row) => Object.entries(row).map(([key, value]) => `${key}: ${value}`).join('; ')).join('\n\n'), safeName);
                if (!knowledge.length) throw new FileIngestionError('No useful knowledge rows were found');
                return { knowledge };
            }
            const productRows = rows.filter((row) => rowHasValue(row, 'product', 'product name', 'price', 'regular price', 'base price', 'sale price', 'sku', 'stock', 'quantity', 'qty', 'category', 'barcode', 'gtin', 'size', 'color', 'colour', 'variant', 'variant name'));
            const parsed = productsFromRows(productRows);
            const knowledge = hasKnowledge ? knowledgeFromRows(rows.filter((row) => !productRows.includes(row)), safeName) : [];
            if (!parsed.products.length && !knowledge.length) throw new FileIngestionError('No useful product or knowledge rows were found');
            const warnings = [
                ...(parsed.skipped ? [`Skipped ${parsed.skipped} row(s) without a product name.`] : []),
                ...(parsed.needsAttention ? [`${parsed.needsAttention} product row(s) need a price before approval.`] : []),
            ];
            return { products: parsed.products.length ? parsed.products : undefined, knowledge: knowledge.length ? knowledge : undefined, warnings };
        }
        let text = '';
        if (extension === '.txt') text = buffer.toString('utf8');
        if (extension === '.docx') text = (await mammoth.extractRawText({ buffer })).value;
        if (extension === '.pdf') text = (await pdf(buffer)).text;
        const classified = classifyTextDocument(text, safeName);
        if (!classified.products?.length && !classified.knowledge?.length && !classified.business) throw new FileIngestionError('No useful text was found in this file');
        return classified;
    } catch (error) {
        if (error instanceof FileIngestionError) throw error;
        throw new FileIngestionError(`We couldn't read this ${extension.slice(1).toUpperCase()} file. Check that it is valid and try again.`);
    }
}
