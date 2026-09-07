'use client';
import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {trackCustomer} from '@/lib/tracking';
export function CustomerTracker(){const path=usePathname();useEffect(()=>{if(!/^\/(shop|cart|products\/)/.test(path))return;void trackCustomer('page_viewed',{path});if(path.startsWith('/products/'))void trackCustomer('product_viewed',{path,productId:path.split('/').pop()||''});const query=new URLSearchParams(location.search).get('search');if(query)void trackCustomer('product_searched',{query});},[path]);return null;}
