import { NextFunction, Request, Response } from 'express';
import { BusinessMember } from '../models/BusinessMember';
import { BUSINESS_ROLES, BusinessRole, TenantPrincipal, withTenantContext } from '../tenancy/context';
import { verifyAccessToken, verifyAccountToken } from './token';

export interface AuthenticatedRequest extends Request {
    auth?: TenantPrincipal;
}

export interface AccountAuthenticatedRequest extends Request {
    account?: { userId: string };
}

function bearerToken(req: Request) {
    const value = req.headers.authorization;
    return value?.startsWith('Bearer ') ? value.slice(7) : undefined;
}

export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction) {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
        const payload = verifyAccessToken(token);
        const membership = await BusinessMember.findOne({
            _id: payload.membershipId,
            userId: payload.sub,
            businessId: payload.businessId,
            role: payload.role,
            status: 'active',
        }).lean();
        if (!membership) return res.status(401).json({ error: 'Membership is no longer active' });

        req.auth = {
            userId: payload.sub,
            businessId: payload.businessId,
            membershipId: payload.membershipId,
            role: payload.role,
        };
        return withTenantContext(req.auth, () => next());
    } catch {
        return res.status(401).json({ error: 'Invalid or expired access token' });
    }
}

export async function authenticateAccount(req: AccountAuthenticatedRequest, res: Response, next: NextFunction) {
    const token = bearerToken(req);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        const payload = verifyAccountToken(token);
        req.account = { userId: payload.sub };
        return next();
    } catch {
        return res.status(401).json({ error: 'Invalid or expired account token' });
    }
}

export function authorize(...roles: BusinessRole[]) {
    const allowed = roles.length ? roles : [...BUSINESS_ROLES];
    return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        if (!req.auth) return res.status(401).json({ error: 'Authentication required' });
        if (!allowed.includes(req.auth.role)) return res.status(403).json({ error: 'Insufficient permissions' });
        return next();
    };
}

export const requireAdministrator = authorize('Owner', 'Admin');
