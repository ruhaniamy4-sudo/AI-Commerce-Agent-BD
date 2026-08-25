import express from 'express';
import mongoose from 'mongoose';
import request from 'supertest';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { authenticate } from '../../auth/middleware';
import { signAccessToken } from '../../auth/token';
import { BusinessMember } from '../../models/BusinessMember';
import { Business } from '../../models/Business';
import { BusinessChannel } from '../../models/BusinessChannel';
import { Conversation } from '../../models/Conversation';
import { CourierIntegration } from '../../models/CourierIntegration';
import { Customer } from '../../models/Customer';
import { Product } from '../../models/Product';
import { Knowledge } from '../../models/Knowledge';
import { Order } from '../../models/Order';
import { AIUsage } from '../../models/AIUsage';
import dashboardRoutes from '../dashboard.routes';

vi.mock('../../services/agentManager', () => ({ getAgentStatus: vi.fn().mockResolvedValue('active') }));
const app = express().use(express.json()).use('/api', authenticate, dashboardRoutes);

describe('merchant dashboard overview tenancy', () => {
    const businessId = new mongoose.Types.ObjectId(); const userId = new mongoose.Types.ObjectId(); const membershipId = new mongoose.Types.ObjectId();
    beforeEach(() => {
        process.env.AUTH_JWT_SECRET = 'test-secret-with-at-least-thirty-two-characters'; vi.restoreAllMocks();
        vi.spyOn(BusinessMember, 'findOne').mockReturnValue({ lean: vi.fn().mockResolvedValue({ _id: membershipId }) } as never);
        vi.spyOn(Business, 'findById').mockReturnValue({ lean: vi.fn().mockResolvedValue({ name: 'Business A', onboarding: {} }) } as never);
        vi.spyOn(Conversation, 'countDocuments').mockResolvedValue(0); vi.spyOn(Customer, 'countDocuments').mockResolvedValue(0);
        vi.spyOn(Product, 'countDocuments').mockResolvedValue(0); vi.spyOn(Knowledge, 'countDocuments').mockResolvedValue(0);
        vi.spyOn(Order, 'aggregate').mockResolvedValue([]); vi.spyOn(AIUsage, 'aggregate').mockResolvedValue([]);
        vi.spyOn(Order, 'find').mockReturnValue({ select: vi.fn().mockReturnValue({ sort: vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) }) }) } as never);
        vi.spyOn(CourierIntegration, 'findOne').mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue(null) }) } as never);
    });
    it('queries non-plugin channel records with the authenticated business ID', async () => {
        const channelFind = vi.spyOn(BusinessChannel, 'find').mockReturnValue({ select: vi.fn().mockReturnValue({ lean: vi.fn().mockResolvedValue([]) }) } as never);
        const token = signAccessToken({ sub: userId.toString(), businessId: businessId.toString(), membershipId: membershipId.toString(), role: 'Staff' });
        const response = await request(app).get('/api/dashboard/overview').set('authorization', `Bearer ${token}`).expect(200);
        expect(channelFind).toHaveBeenCalledWith({ businessId: businessId.toString() });
        expect(response.body.business.name).toBe('Business A');
    });
});
