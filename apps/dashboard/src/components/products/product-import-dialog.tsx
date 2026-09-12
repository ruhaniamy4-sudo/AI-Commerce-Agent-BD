'use client';

import { useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell } from '@/components/ui/table';
import { productsApi, BulkImportRowResult } from '@/lib/api';
import { ApiError } from '@/lib/api-client';
import { parseCsv, downloadCsv } from '@/lib/csv';
import { Download, FileSpreadsheet, Loader2, UploadCloud, CheckCircle2, XCircle, AlertTriangle, RotateCcw } from 'lucide-react';

interface ImportColumn {
    key: string;
    header: string;
    required: boolean;
    hint: string;
    aliases: string[];
}

const IMPORT_COLUMNS: ImportColumn[] = [
    { key: 'name', header: 'name', required: true, hint: 'Product name shown to customers', aliases: ['name', 'productname', 'product'] },
    { key: 'category', header: 'category', required: true, hint: 'Category name — created automatically if new', aliases: ['category', 'categoryname'] },
    { key: 'basePrice', header: 'basePrice', required: true, hint: 'Selling price (numbers only)', aliases: ['baseprice', 'price'] },
    { key: 'description', header: 'description', required: false, hint: 'Defaults to the product name if left blank', aliases: ['description', 'desc'] },
    { key: 'currency', header: 'currency', required: false, hint: 'BDT, USD, EUR, GBP or INR (default BDT)', aliases: ['currency'] },
    { key: 'stock', header: 'stock', required: false, hint: 'Units in stock — leave blank if unknown', aliases: ['stock', 'quantity', 'qty'] },
    { key: 'sku', header: 'sku', required: false, hint: 'Your product code — the AI shows it in chat so customers can order by it. Must be unique; auto-generated if blank', aliases: ['sku', 'barcode', 'code', 'productcode'] },
    { key: 'brand', header: 'brand', required: false, hint: 'Brand name', aliases: ['brand'] },
    { key: 'images', header: 'images', required: false, hint: 'Image URLs separated by | (pipe)', aliases: ['images', 'image', 'imageurl', 'imageurls'] },
    { key: 'isActive', header: 'isActive', required: false, hint: 'true/false — show in store (default true)', aliases: ['isactive', 'active'] },
    { key: 'isFeatured', header: 'isFeatured', required: false, hint: 'true/false — highlight in store (default false)', aliases: ['isfeatured', 'featured'] },
    { key: 'isReturnable', header: 'isReturnable', required: false, hint: 'true/false — allow returns (default true)', aliases: ['isreturnable', 'returnable'] },
    { key: 'warrantyMonths', header: 'warrantyMonths', required: false, hint: 'Warranty length in months (default 0)', aliases: ['warrantymonths', 'warranty'] },
    { key: 'lowStockThreshold', header: 'lowStockThreshold', required: false, hint: 'Low-stock alert threshold (default 10)', aliases: ['lowstockthreshold', 'lowstock'] },
];

const SAMPLE_ROWS: string[][] = [
    ['Classic Cotton T-Shirt', 'Clothing', '650', 'Soft 100% cotton t-shirt available in multiple colors.', 'BDT', '100', 'TS-001', 'SellPilot Basics', 'https://example.com/images/tshirt-1.jpg|https://example.com/images/tshirt-2.jpg', 'true', 'false', 'true', '0', '10'],
    ['Wireless Mouse', 'Electronics', '1200', 'Ergonomic wireless mouse with USB receiver.', 'BDT', '25', 'WM-002', 'SellPilot Tech', 'https://example.com/images/mouse-1.jpg', 'true', 'true', 'true', '6', '5'],
];

const ALIAS_TO_KEY = new Map<string, string>();
for (const column of IMPORT_COLUMNS) for (const alias of column.aliases) ALIAS_TO_KEY.set(alias, column.key);

function normalizeHeader(value: string) {
    return value.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface ParsedRow {
    rowNumber: number;
    values: Record<string, string>;
    errors: string[];
}

const MAX_ROWS = 500;
const BATCH_SIZE = 25;

function normalizeSku(value: string) {
    return value.trim().toUpperCase().replace(/\s+/g, '-').replace(/[^A-Z0-9-]/g, '').slice(0, 24);
}

function parseRows(text: string): ParsedRow[] {
    const table = parseCsv(text);
    if (table.length < 2) return [];
    const columnKeys = table[0].map((cell) => ALIAS_TO_KEY.get(normalizeHeader(cell)));
    const seenSkus = new Map<string, number>();

    return table
        .slice(1)
        .map((cells, index) => {
            const values: Record<string, string> = {};
            columnKeys.forEach((key, colIndex) => {
                if (key) values[key] = (cells[colIndex] ?? '').trim();
            });
            return { rowNumber: index + 2, values };
        })
        .filter(({ values }) => Object.values(values).some((value) => value !== ''))
        .map(({ rowNumber, values }) => {
            const errors: string[] = [];
            const basePrice = Number(values.basePrice);
            if (!values.name) errors.push('Name is required');
            if (!values.category) errors.push('Category is required');
            if (!values.basePrice || !Number.isFinite(basePrice) || basePrice < 0) errors.push('A valid price is required');
            if (values.sku) {
                const sku = normalizeSku(values.sku);
                if (sku.length < 2) errors.push('SKU needs at least 2 letters or digits');
                else if (seenSkus.has(sku)) errors.push(`SKU ${sku} is already used in row ${seenSkus.get(sku)}`);
                else seenSkus.set(sku, rowNumber);
            }
            return { rowNumber, values, errors };
        });
}

function downloadTemplate() {
    const header = IMPORT_COLUMNS.map((column) => column.header);
    downloadCsv('sellpilot-product-import-template.csv', [header, ...SAMPLE_ROWS]);
}

type Stage = 'select' | 'preview' | 'importing' | 'done';

interface ProductImportDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

export function ProductImportDialog({ open, onOpenChange }: ProductImportDialogProps) {
    const queryClient = useQueryClient();
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [stage, setStage] = useState<Stage>('select');
    const [fileName, setFileName] = useState('');
    const [rows, setRows] = useState<ParsedRow[]>([]);
    const [progress, setProgress] = useState({ done: 0, total: 0 });
    const [results, setResults] = useState<BulkImportRowResult[]>([]);

    function reset() {
        setStage('select');
        setFileName('');
        setRows([]);
        setProgress({ done: 0, total: 0 });
        setResults([]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    }

    async function handleFileSelected(file: File) {
        if (!/\.csv$/i.test(file.name) && file.type !== 'text/csv') {
            toast.error('Please choose a .csv file. Export from Excel or Google Sheets as CSV first.');
            return;
        }
        const text = await file.text();
        const parsed = parseRows(text);
        if (parsed.length === 0) {
            toast.error('No product rows found. Use the sample template to check the expected format.');
            return;
        }
        if (parsed.length > MAX_ROWS) {
            toast.error(`This file has ${parsed.length} rows. Import is limited to ${MAX_ROWS} products per file.`);
            return;
        }
        setFileName(file.name);
        setRows(parsed);
        setStage('preview');
    }

    async function runImport() {
        const validRows = rows.filter((row) => row.errors.length === 0);
        setStage('importing');
        setProgress({ done: 0, total: validRows.length });
        const collected: BulkImportRowResult[] = rows
            .filter((row) => row.errors.length > 0)
            .map((row) => ({ row: row.rowNumber, name: row.values.name, status: 'error' as const, error: row.errors.join('; ') }));

        for (let i = 0; i < validRows.length; i += BATCH_SIZE) {
            const batch = validRows.slice(i, i + BATCH_SIZE);
            const payload = batch.map((row) => ({ row: row.rowNumber, ...row.values, basePrice: Number(row.values.basePrice) }));
            try {
                const response = await productsApi.bulkImport(payload);
                collected.push(...response.results);
            } catch (error) {
                const message = error instanceof ApiError ? error.message : 'Import request failed for this batch';
                batch.forEach((row) => collected.push({ row: row.rowNumber, name: row.values.name, status: 'error', error: message }));
            }
            setProgress({ done: Math.min(i + BATCH_SIZE, validRows.length), total: validRows.length });
        }

        collected.sort((a, b) => a.row - b.row);
        setResults(collected);
        setStage('done');
        queryClient.invalidateQueries({ queryKey: ['products'] });
        queryClient.invalidateQueries({ queryKey: ['categories'] });
    }

    const invalidCount = rows.filter((row) => row.errors.length > 0).length;
    const validCount = rows.length - invalidCount;
    const createdCount = results.filter((row) => row.status === 'created').length;
    const failedCount = results.length - createdCount;

    return (
        <Dialog open={open} onOpenChange={(next) => { onOpenChange(next); if (!next) reset(); }}>
            <DialogContent className="max-w-3xl p-0 overflow-hidden border-border shadow-2xl rounded-xl bg-background text-foreground">
                <div className="flex flex-col max-h-[85vh]">
                <DialogHeader className="p-6 bg-muted/5 border-b border-border">
                    <div className="flex items-center justify-between">
                        <div>
                            <DialogTitle className="text-2xl font-semibold text-foreground tracking-tight">Import Products</DialogTitle>
                            <DialogDescription className="text-muted-foreground font-medium mt-1">
                                Bulk-add products from a spreadsheet instead of entering them one by one.
                            </DialogDescription>
                        </div>
                        <div className="hidden sm:flex bg-primary/10 px-4 py-2 rounded-2xl border border-primary/20">
                            <span className="text-primary font-black text-[10px] uppercase tracking-[0.2em]">CSV Import</span>
                        </div>
                    </div>
                </DialogHeader>

                <div className="flex-1 overflow-y-auto p-6">
                    {stage === 'select' && (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="space-y-3 p-6 bg-muted/30 border border-border rounded-2xl">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-black">1</span>
                                        <h4 className="font-bold text-foreground tracking-tight">Download the template</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Get a sample CSV with every supported column and two example products already filled in.
                                    </p>
                                    <Button type="button" variant="outline" onClick={downloadTemplate} className="rounded-xl">
                                        <Download size={15} className="mr-2" /> Download Sample CSV
                                    </Button>
                                </div>
                                <div className="space-y-3 p-6 bg-muted/30 border border-border rounded-2xl">
                                    <div className="flex items-center gap-2">
                                        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-primary text-primary-foreground text-[11px] font-black">2</span>
                                        <h4 className="font-bold text-foreground tracking-tight">Upload your file</h4>
                                    </div>
                                    <p className="text-sm text-muted-foreground">
                                        Fill in the template (or export your own sheet as CSV) and upload it here for review before anything is created.
                                    </p>
                                    <input
                                        ref={fileInputRef}
                                        type="file"
                                        accept=".csv,text/csv"
                                        className="hidden"
                                        onChange={(event) => { const file = event.target.files?.[0]; if (file) handleFileSelected(file); }}
                                    />
                                    <Button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-xl">
                                        <UploadCloud size={15} className="mr-2" /> Choose CSV File
                                    </Button>
                                </div>
                            </div>

                            <div className="p-6 bg-white/[0.02] border border-white/5 rounded-2xl">
                                <div className="flex items-center gap-2 mb-4">
                                    <FileSpreadsheet size={16} className="text-primary" />
                                    <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">Supported Columns</h5>
                                </div>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
                                    {IMPORT_COLUMNS.map((column) => (
                                        <div key={column.key} className="flex items-start justify-between gap-3 text-sm">
                                            <div>
                                                <span className="font-mono font-semibold text-foreground">{column.header}</span>
                                                {column.required && <span className="ml-1.5 text-[10px] font-black uppercase tracking-wide text-primary">Required</span>}
                                                <p className="text-xs text-muted-foreground mt-0.5">{column.hint}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                                <p className="text-xs text-muted-foreground mt-4">
                                    A new category is created automatically the first time it appears in the file. Up to {MAX_ROWS} products per import.
                                </p>
                            </div>
                        </div>
                    )}

                    {stage === 'preview' && (
                        <div className="space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3">
                                <div>
                                    <p className="font-bold text-foreground">{fileName}</p>
                                    <p className="text-sm text-muted-foreground">{rows.length} rows found — {validCount} ready to import{invalidCount ? `, ${invalidCount} need fixing` : ''}.</p>
                                </div>
                                <Button type="button" variant="ghost" onClick={reset} className="text-muted-foreground">
                                    <RotateCcw size={14} className="mr-2" /> Choose a different file
                                </Button>
                            </div>
                            <div className="border border-border rounded-2xl overflow-hidden">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Row</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Category</TableHead>
                                            <TableHead>Price</TableHead>
                                            <TableHead>Stock</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {rows.map((row) => (
                                            <TableRow key={row.rowNumber}>
                                                <TableCell className="text-muted-foreground">{row.rowNumber}</TableCell>
                                                <TableCell className="font-medium">{row.values.name || '—'}</TableCell>
                                                <TableCell>{row.values.category || '—'}</TableCell>
                                                <TableCell>{row.values.basePrice || '—'} {row.values.currency}</TableCell>
                                                <TableCell>{row.values.stock || '—'}</TableCell>
                                                <TableCell>
                                                    {row.errors.length === 0 ? (
                                                        <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> Ready</Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="gap-1" title={row.errors.join('; ')}><XCircle size={12} /> {row.errors[0]}</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                            {invalidCount > 0 && (
                                <div className="flex items-start gap-2 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-xl text-sm text-yellow-600 dark:text-yellow-400">
                                    <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                                    <p>Rows that need fixing will be skipped. Fix them in your spreadsheet and re-upload to include them, or continue to import the {validCount} ready rows now.</p>
                                </div>
                            )}
                        </div>
                    )}

                    {stage === 'importing' && (
                        <div className="py-16 flex flex-col items-center justify-center gap-4">
                            <Loader2 className="h-8 w-8 text-primary animate-spin" />
                            <p className="font-bold text-foreground">Importing {progress.done} of {progress.total} products…</p>
                            <div className="w-full max-w-sm h-2 rounded-full bg-muted overflow-hidden">
                                <div
                                    className="h-full bg-primary transition-all"
                                    style={{ width: `${progress.total ? Math.round((progress.done / progress.total) * 100) : 0}%` }}
                                />
                            </div>
                        </div>
                    )}

                    {stage === 'done' && (
                        <div className="space-y-4">
                            <div className="flex items-center gap-4 p-5 bg-muted/30 border border-border rounded-2xl">
                                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 border border-primary/20">
                                    <CheckCircle2 className="h-6 w-6 text-primary" />
                                </div>
                                <div>
                                    <p className="font-bold text-foreground text-lg">{createdCount} product{createdCount === 1 ? '' : 's'} imported</p>
                                    <p className="text-sm text-muted-foreground">{failedCount > 0 ? `${failedCount} row${failedCount === 1 ? '' : 's'} could not be imported — see details below.` : 'Everything imported successfully.'}</p>
                                </div>
                            </div>
                            <div className="border border-border rounded-2xl overflow-hidden max-h-[300px] overflow-y-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Row</TableHead>
                                            <TableHead>Name</TableHead>
                                            <TableHead>Status</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {results.map((result) => (
                                            <TableRow key={result.row}>
                                                <TableCell className="text-muted-foreground">{result.row}</TableCell>
                                                <TableCell className="font-medium">{result.name || '—'}</TableCell>
                                                <TableCell>
                                                    {result.status === 'created' ? (
                                                        <Badge variant="success" className="gap-1"><CheckCircle2 size={12} /> Imported</Badge>
                                                    ) : (
                                                        <Badge variant="destructive" className="gap-1" title={result.error}><XCircle size={12} /> {result.error || 'Failed'}</Badge>
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>

                <DialogFooter className="p-6 bg-muted/20 border-t border-border">
                    {stage === 'select' && (
                        <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">Cancel</Button>
                    )}
                    {stage === 'preview' && (
                        <>
                            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} className="rounded-2xl">Cancel</Button>
                            <Button type="button" onClick={runImport} disabled={validCount === 0} className="rounded-2xl px-8 font-black">
                                Import {validCount} Product{validCount === 1 ? '' : 's'}
                            </Button>
                        </>
                    )}
                    {stage === 'done' && (
                        <>
                            <Button type="button" variant="outline" onClick={reset} className="rounded-2xl">Import Another File</Button>
                            <Button type="button" onClick={() => onOpenChange(false)} className="rounded-2xl px-8 font-black">Done</Button>
                        </>
                    )}
                </DialogFooter>
                </div>
            </DialogContent>
        </Dialog>
    );
}
