'use client';
import {useParams} from 'next/navigation';
import Link from 'next/link';
import {CustomerIntelligencePanel} from '@/components/customers/customer-intelligence-panel';
import {PageHeader} from '@/components/layout/page-header';
export default function CustomerDetail(){const params=useParams();return <div><PageHeader title="Customer intelligence" description="Customer behavior, commerce history, and the evidence behind every score." actions={<Link href="/customers">Back to customers</Link>}/><div className="max-w-2xl"><CustomerIntelligencePanel customerId={String(params.id)}/></div></div>;}
