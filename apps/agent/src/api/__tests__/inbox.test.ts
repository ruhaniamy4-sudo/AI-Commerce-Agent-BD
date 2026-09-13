import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Conversation } from '../../models/Conversation';
import { Customer } from '../../models/Customer';
import { withTenantContext } from '../../tenancy/context';
import adminRoutes, { inboxChannelOf, inboxFilter } from '../admin.routes';

const businessId = new mongoose.Types.ObjectId().toString();

const app = express()
    .use(express.json())
    .use((req, _res, next) => {
        (req as any).auth = { businessId, userId: 'u', membershipId: 'm', role: 'Owner' };
        withTenantContext({ businessId, userId: 'u', membershipId: 'm', role: 'Owner' }, () => next());
    })
    .use('/api', adminRoutes);

describe('inbox filters', () => {
    it('never lists a thread that has no messages', () => {
        for (const channel of ['all', 'messenger', 'whatsapp', 'web', 'test'] as const) {
            expect(inboxFilter(channel, 'all')).toMatchObject({ messageCount: { $gt: 0 } });
        }
    });

    it('keeps Test AI rehearsals out of the merchant inbox but gives them their own tab', () => {
        expect(inboxFilter('all', 'all')).toMatchObject({ $nor: [{ platform: 'manual', 'metadata.testMode': true }] });
        expect(inboxFilter('test', 'all')).toMatchObject({ platform: 'manual', 'metadata.testMode': true });
    });

    it('scopes each channel tab to the platforms that feed it', () => {
        expect(inboxFilter('messenger', 'all')).toMatchObject({ platform: { $in: ['facebook', 'instagram'] } });
        expect(inboxFilter('whatsapp', 'all')).toMatchObject({ platform: { $in: ['whatsapp'] } });
        expect(inboxFilter('web', 'all')).toMatchObject({ platform: { $in: ['web-widget', 'web'] } });
    });

    it('separates threads waiting on a person from those the AI still holds', () => {
        expect(inboxFilter('all', 'needs_attention')).toMatchObject({ needsHumanHandoff: true });
        expect(inboxFilter('all', 'human')).toMatchObject({ controlMode: 'HUMAN_ACTIVE' });
        expect(inboxFilter('all', 'ai')).toMatchObject({ controlMode: 'AI_ACTIVE' });
    });

    it('labels each thread with the channel the customer used', () => {
        expect(inboxChannelOf({ platform: 'facebook' })).toBe('messenger');
        expect(inboxChannelOf({ platform: 'whatsapp' })).toBe('whatsapp');
        expect(inboxChannelOf({ platform: 'web-widget' })).toBe('web');
        expect(inboxChannelOf({ platform: 'manual', metadata: { testMode: true } })).toBe('test');
        expect(inboxChannelOf({ platform: 'manual' })).toBe('other');
    });
});

describe('inbox endpoint', () => {
    beforeEach(() => vi.restoreAllMocks());

    function mockInbox(rows: any[]) {
        vi.spyOn(Conversation, 'find').mockReturnValue({
            select: () => ({ populate: () => ({ sort: () => ({ skip: () => ({ limit: () => ({ lean: () => Promise.resolve(rows) }) }) }) }) }),
        } as never);
        vi.spyOn(Conversation, 'countDocuments').mockResolvedValue(rows.length as never);
    }

    it('returns the customer, the channel and who is handling each thread', async () => {
        const customerId = new mongoose.Types.ObjectId();
        mockInbox([{
            _id: 'c1', conversationId: 'fb_1_2', platform: 'facebook',
            customerId: { _id: customerId, name: 'Rafiul Islam', phone: '01712345678' },
            controlMode: 'HUMAN_ACTIVE', needsHumanHandoff: true, messageCount: 8,
            lastMessagePreview: 'kalke pabo to?', lastMessageAt: new Date('2026-09-13T09:00:00Z'), updatedAt: new Date(),
        }]);

        const response = await request(app).get('/api/conversations').expect(200);
        expect(response.body.data[0]).toMatchObject({
            channel: 'messenger',
            customer: { name: 'Rafiul Islam', phone: '01712345678' },
            controlMode: 'HUMAN_ACTIVE',
            needsHumanHandoff: true,
            lastMessage: 'kalke pabo to?',
            messageCount: 8,
        });
        expect(response.body.counts).toHaveProperty('needsAttention');
    });

    it('asks the database for the tab the merchant selected', async () => {
        mockInbox([]);
        await request(app).get('/api/conversations?channel=whatsapp&state=needs_attention').expect(200);
        const filter = (Conversation.find as any).mock.calls[0][0];
        expect(filter).toMatchObject({ platform: { $in: ['whatsapp'] }, needsHumanHandoff: true, messageCount: { $gt: 0 } });
    });

    it('finds a thread by the customer name, not only by message text', async () => {
        const customerId = new mongoose.Types.ObjectId();
        vi.spyOn(Customer, 'find').mockReturnValue({
            select: () => ({ limit: () => ({ lean: () => Promise.resolve([{ _id: customerId }]) }) }),
        } as never);
        mockInbox([]);

        await request(app).get('/api/conversations?search=Rafiul').expect(200);
        const filter = (Conversation.find as any).mock.calls[0][0];
        expect(JSON.stringify(filter.$and[0].$or)).toContain(String(customerId));
    });
});
