export function normalizeBangladeshPhone(input: string): string {
    const compact = String(input || '').replace(/[\s()\-.]/g, '');
    const local = compact.startsWith('+880')
        ? `0${compact.slice(4)}`
        : compact.startsWith('880')
          ? `0${compact.slice(3)}`
          : compact;

    if (!/^01[3-9]\d{8}$/.test(local)) {
        throw new Error('A valid Bangladesh mobile number is required');
    }
    return local;
}
