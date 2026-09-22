'use client';
import {useState} from 'react';
import Link from 'next/link';
import {useQuery} from '@tanstack/react-query';
import {BookOpenCheck,ChevronDown,ChevronRight} from 'lucide-react';
import {platformApi,type AuditRow} from '@/lib/platform-api';
import {ExportLink,PageHeading,Pager,Panel,Status,Toolbar,dateTime} from '@/components/platform/platform-ui';

const ACTIONS=[
 'BUSINESS_SUSPENDED','BUSINESS_REACTIVATED','BUSINESS_ERASED','AI_SUSPENDED','AI_RESUMED','AI_LIMITS_UPDATED',
 'USER_SUSPENDED','USER_REACTIVATED','USER_EMAIL_VERIFIED','USER_SESSIONS_REVOKED','MEMBERSHIP_ROLE_CHANGED',
 'NEW_SUBSCRIPTION','RENEWAL','STATUS_CHANGE','PLAN_CREATED','PLAN_UPDATED',
 'MANUAL_BILLING_ADJUSTMENT','PAYMENT_REFUNDED','COUPON_CREATED','COUPON_UPDATED','COUPON_DISABLED','COUPON_DELETED',
 'PLATFORM_SETTING_UPDATED','PLATFORM_SETTING_RESET','FEATURE_FLAG_CREATED','FEATURE_FLAG_UPDATED','FEATURE_FLAG_DELETED',
 'ANNOUNCEMENT_CREATED','ANNOUNCEMENT_PUBLISHED','ANNOUNCEMENT_UPDATED','ANNOUNCEMENT_DELETED',
 'PROMPT_CREATED','PROMPT_UPDATED','PROMPT_ACTIVATED','PROMPT_DELETED','NOTIFICATION_TEMPLATE_UPDATED',
 'PLATFORM_ADMIN_CREATED','PLATFORM_ADMIN_UPDATED','PLATFORM_ADMIN_PASSWORD_RESET','ADMIN_LOGIN',
 'QUEUE_RETRY','QUEUE_PAUSE','QUEUE_RESUME','QUEUE_DRAIN','RETENTION_PURGE','DELETION_REQUEST_COMPLETED',
 'TENANT_DATA_EXPORTED','DATA_EXPORTED',
];
const toneFor=(action:string)=>/SUSPEND|DELETE|ERASE|PURGE|DRAIN|REFUND/.test(action)?'danger':/CREATE|REACTIVAT|RESUME|ACTIVAT/.test(action)?'success':/UPDATE|CHANGE|RESET/.test(action)?'warning':'info';

export default function Audit(){
 const [search,setSearch]=useState('');
 const [action,setAction]=useState('');
 const [page,setPage]=useState(1);
 const [open,setOpen]=useState<string|null>(null);
 const {data,isLoading}=useQuery({queryKey:['audit',search,action,page],queryFn:()=>platformApi.audit(search,action,page)});

 return <div>
  <PageHeading eyebrow="Governance" title="Audit log" copy="Every platform change, with who made it, what it affected, and the reason they gave." actions={<>
   <Status tone="info">{data?.pagination.total.toLocaleString()||0} entries</Status>
   <ExportLink href={platformApi.exportUrl('audit','12m')}/>
  </>}/>

  <Panel title="Recorded changes" copy="Open a row to see the values before and after" action={<Toolbar>
   <input className="platform-control" placeholder="Action, target, or reason" value={search} onChange={event=>{setSearch(event.target.value);setPage(1)}}/>
   <select className="platform-control" value={action} onChange={event=>{setAction(event.target.value);setPage(1)}}><option value="">All actions</option>{ACTIONS.map(value=><option key={value}>{value}</option>)}</select>
  </Toolbar>}>
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th /><th>When</th><th>Action</th><th>Workspace</th><th>Target</th><th>Administrator</th><th>Reason</th></tr></thead><tbody>
    {data?.data.map(row=><Row key={row._id} row={row} open={open===row._id} onToggle={()=>setOpen(open===row._id?null:row._id)}/>)}
   </tbody></table>
   {!isLoading&&!data?.data.length&&<div className="platform-empty"><BookOpenCheck size={20}/>No audit entries match this view.</div>}</div>
   {data&&<Pager page={data.pagination.page} totalPages={data.pagination.totalPages} total={data.pagination.total} onPage={setPage}/>}
  </Panel>
 </div>;
}

function Row({row,open,onToggle}:{row:AuditRow;open:boolean;onToggle:()=>void}){
 const hasDiff=row.previousValue!==undefined||row.newValue!==undefined;
 return <>
  <tr onClick={hasDiff?onToggle:undefined} style={hasDiff?{cursor:'pointer'}:undefined}>
   <td>{hasDiff?(open?<ChevronDown size={13}/>:<ChevronRight size={13}/>):null}</td>
   <td>{dateTime(row.createdAt)}</td>
   <td><Status tone={toneFor(row.action)}>{row.action.replaceAll('_',' ')}</Status></td>
   <td>{row.business?.id?<Link href={`/platform-admin/businesses/${row.business.id}`}>{row.business.name}</Link>:'—'}</td>
   <td><strong>{row.targetType}</strong><small>{row.targetId}</small></td>
   <td><strong>{row.admin?.name||'Unknown'}</strong><small>{row.admin?.email}</small></td>
   <td>{row.reason}</td>
  </tr>
  {open&&hasDiff&&<tr><td /><td colSpan={6}>
   <div className="platform-grid equal" style={{marginTop:0}}>
    <div><p className="platform-group-title">Before</p><pre className="platform-code">{JSON.stringify(row.previousValue??null,null,2)}</pre></div>
    <div><p className="platform-group-title">After</p><pre className="platform-code">{JSON.stringify(row.newValue??null,null,2)}</pre></div>
   </div>
  </td></tr>}
 </>;
}
