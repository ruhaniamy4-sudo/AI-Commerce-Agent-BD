import mongoose from 'mongoose';
import { Business } from '../models/Business';
import { enterTenantContext } from './context';

export async function initializeScriptTenantContext() {
    const selector = process.env.BUSINESS_ID
        ? { _id: new mongoose.Types.ObjectId(process.env.BUSINESS_ID) }
        : { slug: process.env.DEFAULT_BUSINESS_SLUG || 'default-business' };
    const business = await Business.findOne({ ...selector, status: 'active' }).lean();
    if (!business) throw new Error('No active business found for this script');
    enterTenantContext({
        businessId: business._id.toString(),
        userId: 'maintenance-script',
        membershipId: 'maintenance-script',
        role: 'Owner',
    });
    return business;
}
