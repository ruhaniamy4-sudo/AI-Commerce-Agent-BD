import { NextFunction, Request, Response } from 'express';
import { BusinessChannel } from '../models/BusinessChannel';
import { withTenantContext } from '../tenancy/context';

export async function resolvePublicChannel(req: Request, res: Response, next: NextFunction) {
    const externalId = req.params.channelId;
    const channel = await BusinessChannel.findOne({ platform: 'web', externalId, status: 'active' }).lean();
    if (!channel) return res.status(404).json({ error: 'Business channel not found' });
    return withTenantContext({
        businessId: channel.businessId.toString(),
        userId: 'public-channel',
        membershipId: 'public-channel',
        role: 'Staff',
    }, () => next());
}
