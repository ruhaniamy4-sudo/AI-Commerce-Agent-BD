import mongoose from 'mongoose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AuthActionToken } from '../models/AuthActionToken';
import { consumeAuthActionToken, issueAuthActionToken } from './action-token';

describe('one-time authentication action tokens', () => {
    const userId = new mongoose.Types.ObjectId().toString();
    beforeEach(() => vi.restoreAllMocks());

    it('invalidates earlier live tokens and stores only the new token hash', async () => {
        const invalidate = vi.spyOn(AuthActionToken, 'updateMany').mockResolvedValue({ acknowledged: true } as any);
        const create = vi.spyOn(AuthActionToken, 'create').mockImplementation(async (value: any) => ({ _id: new mongoose.Types.ObjectId(), ...value }) as any);
        const issued = await issueAuthActionToken(userId, 'password_reset');
        expect(invalidate).toHaveBeenCalled();
        expect(create.mock.calls[0][0]).not.toHaveProperty('token');
        expect(JSON.stringify(create.mock.calls[0][0])).not.toContain(issued.token);
    });

    it('consumes a matching token only once and rejects malformed input', async () => {
        const consume = vi.spyOn(AuthActionToken, 'findOneAndUpdate').mockResolvedValue({ userId: new mongoose.Types.ObjectId(userId) } as any);
        await expect(consumeAuthActionToken('one-time-token', 'email_verification')).resolves.toBeTruthy();
        expect(consume).toHaveBeenCalledWith(expect.objectContaining({ type: 'email_verification', consumedAt: null }), expect.anything(), expect.anything());
        await expect(consumeAuthActionToken('', 'email_verification')).resolves.toBeNull();
        expect(consume).toHaveBeenCalledTimes(1);
    });
});
