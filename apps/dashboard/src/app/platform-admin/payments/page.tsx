'use client';
import {useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CreditCard,ReceiptText,RotateCcw,TriangleAlert} from 'lucide-react';
import {platformApi,type BillingRow} from '@/lib/platform-api';
import {ExportLink,PageHeading,Pager,Panel,RevenueChart,StatCard,Status,Toolbar,dateTime,money} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';

const PERIODS:Array<[string,string]>=[['7d','Last 7 days'],['30d','Last 30 days'],['this_month','This month'],['3m','Last 3 months'],['12m','Last 12 months']];
const FILTERS=['ALL','PAID','PENDING','FAILED','REFUND'];

export default function Payments(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [period,setPeriod]=useState('30d');
 const [search,setSearch]=useState('');
 const [filter,setFilter]=useState('ALL');
 const [page,setPage]=useState(1);
 const [problem,setProblem]=useState('');
 const {data,isLoading}=useQuery({queryKey:['payments',period,search,page],queryFn:()=>platformApi.revenue(period,search,page)});

 const rows=useMemo(()=>(data?.data||[]).filter(row=>filter==='ALL'||row.status===filter||(filter==='REFUND'&&row.type==='REFUND')),[data,filter]);
 const success=data?.data.filter(row=>row.status==='PAID'&&row.type!=='REFUND').length||0;
 const failed=data?.data.filter(row=>row.status==='FAILED').length||0;
 const refunds=data?.data.filter(row=>row.type==='REFUND').length||0;

 const refund=useMutation({
  mutationFn:async(payment:BillingRow)=>{
   const why=await confirm({
    title:`Refund ${payment.amount.toLocaleString()} ${payment.currency}?`,
    description:`A refund is recorded against ${payment.businessName||'this workspace'} and reduces net revenue for the period it falls in.`,
    consequences:['A refund entry is written to the ledger','The original payment is left as it was','Money is not moved by this action — settle it with the provider separately'],
    confirmLabel:'Record refund',tone:'danger',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is being refunded'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.refundPayment(payment._id,{reason:why});
  },
  onSuccess:()=>{setProblem('');qc.invalidateQueries({queryKey:['payments']})},
  onError:(error:Error)=>{if(error.message!=='Cancelled')setProblem(error.message)},
 });

 const manage=can('billing.manage');
 return <div>
  <PageHeading eyebrow="Revenue" title="Payments & billing" copy="Every recorded payment, refund, and manual adjustment, with the controls to correct them." actions={<>
   <ExportLink href={platformApi.exportUrl('payments',period)}/>
   <select className="platform-control" value={period} onChange={event=>{setPeriod(event.target.value);setPage(1)}}>{PERIODS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select>
  </>}/>

  {problem&&<p className="platform-banner danger"><TriangleAlert size={14}/>{problem}</p>}

  <div className="platform-metrics">
   <StatCard label="Net collected" value={money(data?.summary.revenue)} detail="Paid entries minus refunds" tone="green"/>
   <StatCard label="Successful payments" value={success} detail="In the current result set" tone="blue"/>
   <StatCard label="Failed payments" value={failed} detail="Needs collection follow-up" tone="amber"/>
   <StatCard label="Refunded" value={money(data?.summary.refunds)} detail={`${refunds} refund entries`} tone="violet"/>
  </div>

  <div className="platform-grid">
   <Panel title="Payment trend" copy="Net revenue over the selected period"><RevenueChart rows={data?.trend||[]}/></Panel>
   <Panel title="Collection mix" copy="The current transaction result set">
    <ul className="platform-activity">
     <li><i><CreditCard size={13}/></i><div><strong>Paid</strong><span>Successfully recorded</span></div><b>{success}</b></li>
     <li><i><TriangleAlert size={13}/></i><div><strong>Failed</strong><span>Payment attempt failed</span></div><b>{failed}</b></li>
     <li><i><RotateCcw size={13}/></i><div><strong>Refunds</strong><span>Returned to merchants</span></div><b>{refunds}</b></li>
     <li><i><ReceiptText size={13}/></i><div><strong>Ledger records</strong><span>Matching the current search</span></div><b>{data?.pagination.total||0}</b></li>
    </ul>
   </Panel>
  </div>

  <Panel title="Transaction ledger" copy="Refunds are recorded here; moving the money stays with the payment provider" className="mt-4" action={<Toolbar>
   <input className="platform-control" placeholder="Merchant or reference" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}}/>
   <select className="platform-control" value={filter} onChange={event=>setFilter(event.target.value)}>{FILTERS.map(value=><option key={value}>{value}</option>)}</select>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Merchant</th><th>Transaction</th><th>Amount</th><th>Method</th><th>Status</th><th>Date</th><th>Reference</th><th /></tr></thead><tbody>
    {rows.map(payment=><tr key={payment._id}>
     <td><strong>{payment.businessName||'Unknown merchant'}</strong><small>{payment.isTest?'Test environment':'Production'}</small></td>
     <td>{payment.type.replaceAll('_',' ')}</td>
     <td><strong>{payment.amount.toLocaleString()} {payment.currency}</strong></td>
     <td>{payment.provider||'Manual'}</td>
     <td><Status tone={payment.status==='PAID'?'success':payment.status==='FAILED'?'danger':payment.status==='PENDING'?'warning':'info'}>{payment.status}</Status></td>
     <td>{dateTime(payment.paidAt)}</td>
     <td>{payment.providerReference||'—'}</td>
     <td>{manage&&payment.status==='PAID'&&payment.type!=='REFUND'&&<Button variant="outline" size="sm" onClick={()=>refund.mutate(payment)}><RotateCcw size={13}/> Refund</Button>}</td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!rows.length&&<div className="platform-empty">No transactions match this view.</div>}</div>
   {data&&<Pager page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPage={setPage}/>}
  </Panel>

  <p className="platform-banner info" style={{marginTop:15}}><ReceiptText size={14}/>A manual payment or credit for one workspace is recorded from its own detail page, under Merchants → Businesses.</p>
 </div>;
}
