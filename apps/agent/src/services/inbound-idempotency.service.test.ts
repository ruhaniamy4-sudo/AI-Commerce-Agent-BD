import { afterEach, describe, expect, it, vi } from 'vitest';
import { WebhookEvent } from '../models/WebhookEvent';
import { claimInboundEvent } from './inbound-idempotency.service';

describe('inbound processing idempotency', () => {
    afterEach(() => vi.restoreAllMocks());

    it('only grants one processing claim for a repeated event', async () => {
        vi.spyOn(WebhookEvent, 'findOneAndUpdate')
            .mockResolvedValueOnce({ eventId: 'same-event' } as never)
            .mockResolvedValueOnce(null);
        vi.spyOn(WebhookEvent, 'findOne').mockReturnValue({
            lean: vi.fn().mockResolvedValue({ eventId: 'same-event', processed: false }),
        } as never);
        let aiRuns = 0;
        const first = await claimInboundEvent('same-event');
        if (first.claimed) aiRuns += 1;
        const duplicate = await claimInboundEvent('same-event');
        if (duplicate.claimed) aiRuns += 1;
        expect(first.claimed).toBe(true);
        expect(duplicate.claimed).toBe(false);
        expect(aiRuns).toBe(1);
    });
});
