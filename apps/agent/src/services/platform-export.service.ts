/**
 * Server-side CSV export.
 *
 * The console can already turn a table it is showing into a file, but an operator
 * exporting for finance or an audit needs the whole dataset, not the page they are
 * looking at — so exports are built here against the same collections, capped so a
 * single request cannot pull the database into memory.
 */
export const EXPORT_ROW_CAP = 20_000;

const cell = (value: unknown): string => {
    if (value === null || value === undefined) return '';
    if (value instanceof Date) return value.toISOString();
    if (typeof value === 'object') return JSON.stringify(value);
    return String(value);
};

/** RFC 4180: quote anything containing a delimiter, a quote, or a newline. */
const field = (value: unknown) => {
    const text = cell(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

export function toCsv(columns: Array<{ header: string; path: string }>, rows: Array<Record<string, unknown>>) {
    const header = columns.map(column => field(column.header)).join(',');
    const body = rows.map(row => columns.map(column => field(column.path.split('.').reduce<unknown>((value, key) => (value as Record<string, unknown>)?.[key], row))).join(','));
    // Excel opens a UTF-8 file as the system codepage unless it sees a BOM, which
    // turns Bangla merchant names into noise.
    return `﻿${[header, ...body].join('\r\n')}`;
}

export const csvFilename = (dataset: string) => `sellpilot-${dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
