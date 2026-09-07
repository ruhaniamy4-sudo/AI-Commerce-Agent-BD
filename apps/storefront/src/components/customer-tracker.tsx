'use client';
import {useEffect} from 'react';
import {usePathname,useSearchParams} from 'next/navigation';
import {trackCustomer} from '@/lib/tracking';
export function CustomerTracker(){const path=usePathname();const query=useSearchParams().get('search');useEffect(()=>{if(!/^\/(shop|cart|products\/)/.test(path))return;void trackCustomer('page_viewed',{path});if(path.startsWith('/products/'))void trackCustomer('product_viewed',{path,productId:path.split('/').pop()||''});},[path]);useEffect(()=>{if(query&&/^\/(shop|products\/)/.test(path))void trackCustomer('product_searched',{query});},[path,query]);return null;}
