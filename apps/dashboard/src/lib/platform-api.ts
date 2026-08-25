export interface PlatformOverview { businesses:number; activeBusinesses:number; users:number; conversations:number; orders:number; aiUsage:{requests:number;totalTokens:number;estimatedCost:number}; facebookChannels:number; courierIntegrations:number; errors:number }
export interface PlatformBusinessMember { role:string; status:string; user?:{id:string;name:string;email:string} }
export interface PlatformBusiness { _id:string;name:string;slug:string;status:'active'|'suspended';businessType?:string;onboarding?:{completedAt?:string};members:PlatformBusinessMember[];conversations:number;orders:number;customers:number }
export interface PlatformUser { _id:string;name:string;email:string;emailVerified:boolean;status:string;createdAt:string;memberships:Array<{role:string;status:string;business?:{_id:string;name:string}}> }
export interface PlatformUsage { businessId:string;businessName:string;requests:number;inputTokens:number;outputTokens:number;totalTokens:number;estimatedCost:number }
export interface PlatformIntegrations { channels:Array<{_id:Record<string,string>;count:number}>;couriers:Array<{_id:Record<string,string>;count:number}> }
export interface PlatformHealth { api:string;mongo:string;redis:string;worker:string;openaiConfigured:boolean;facebookConfigured:boolean;facebookChannels:number;steadfastConnections:number }
export interface PlatformError { _id:string;type:string;message:string;timestamp:string }
interface Paginated<T>{data:T[];pagination:{page:number;limit:number;total:number;totalPages:number}}
async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await fetch(`/api/platform-admin/${path}`, { ...init, headers: { 'content-type': 'application/json', ...init?.headers }, cache: 'no-store' });
    const body = await response.json(); if (!response.ok) throw new Error(body.error || 'Platform request failed'); return body as T;
}
export const platformApi = {
    overview: () => request<PlatformOverview>('overview'), businesses: (search = '') => request<Paginated<PlatformBusiness>>(`businesses?search=${encodeURIComponent(search)}`),
    setBusinessStatus: (id: string, status: 'active'|'suspended') => request<PlatformBusiness>(`businesses/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    users: (search = '') => request<Paginated<PlatformUser>>(`users?search=${encodeURIComponent(search)}`), usage: () => request<PlatformUsage[]>('usage'),
    integrations: () => request<PlatformIntegrations>('integrations'), health: () => request<PlatformHealth>('health'), errors: () => request<PlatformError[]>('errors'),
    me: () => request<{id:string;name:string;email:string}>('me'),
};
