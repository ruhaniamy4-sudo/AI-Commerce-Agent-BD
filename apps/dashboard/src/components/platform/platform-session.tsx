'use client';
import {useQuery} from '@tanstack/react-query';
import {platformApi,type PlatformIdentity} from '@/lib/platform-api';

/**
 * The signed-in operator and what their role allows.
 *
 * The agent decides permissions and hands the resolved list back on `me`, so the
 * navigation, a page's buttons, and the API all read the same answer — a console
 * can never offer an action the server will refuse.
 */
export function usePlatformIdentity() {
 return useQuery<PlatformIdentity>({queryKey:['platform-me'],queryFn:platformApi.me,staleTime:5*60*1000,retry:false});
}

export function useCan() {
 const {data}=usePlatformIdentity();
 const held=data?.permissions;
 // Until `me` resolves, nothing is granted: an operator briefly seeing fewer
 // controls is better than briefly seeing one they cannot use.
 return (permission:string)=>Boolean(held?.includes('*')||held?.includes(permission));
}
