import { ErrorLog } from '../models/ErrorLog';

export const logError = async (type: string, error: any, context: any = {}) => {
    try {
        await ErrorLog.create({
            type,
            message: error.message || String(error),
            stack: error.stack,
            context,
        });
        console.error(`[ErrorLog] ${type}: ${error.message || error}`);
    } catch (e) {
        console.error('Failed to save error log to database:', e);
    }
};
