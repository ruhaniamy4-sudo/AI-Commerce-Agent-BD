'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {Plus,Tags,Trash2} from 'lucide-react';
import {platformApi,type CouponRow} from '@/lib/platform-api';
import {Field,PageHeading,Panel,StatCard,Status,Toggle,dateOnly} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';
import {Dialog,DialogContent,DialogHeader,DialogTitle} from '@/components/ui/dialog';

type Draft={_id?:string;code:string;description:string;type:string;value:number;currency:string;planSlugs:string;maxRedemptions:number;recurringPeriods:number;validFrom:string;validUntil:string;enabled:boolean};
const blank:Draft={code:'',description:'',type:'PERCENT',value:10,currency:'BDT',planSlugs:'',maxRedemptions:0,recurringPeriods:0,validFrom:'',validUntil:'',enabled:true};
const TYPES:Array<[string,string]>=[['PERCENT','Percent off'],['FIXED','Fixed amount off'],['TRIAL_EXTENSION','Extra trial days']];
const dateInput=(value?:string)=>value?new Date(value).toISOString().slice(0,10):'';
const toDraft=(row:CouponRow):Draft=>({_id:row._id,code:row.code,description:row.description,type:row.type,value:row.value,currency:row.currency,planSlugs:(row.planSlugs||[]).join(', '),maxRedemptions:row.maxRedemptions,recurringPeriods:row.recurringPeriods,validFrom:dateInput(row.validFrom),validUntil:dateInput(row.validUntil),enabled:row.enabled});
const toPayload=(draft:Draft)=>({code:draft.code,description:draft.description,type:draft.type,value:draft.value,currency:draft.currency,planSlugs:draft.planSlugs.split(',').map(entry=>entry.trim()).filter(Boolean),maxRedemptions:draft.maxRedemptions,recurringPeriods:draft.recurringPeriods,validFrom:draft.validFrom||undefined,validUntil:draft.validUntil||undefined,enabled:draft.enabled});
const discountOf=(row:CouponRow)=>row.type==='PERCENT'?`${row.value}% off`:row.type==='FIXED'?`${row.value.toLocaleString()} ${row.currency} off`:`${row.value} extra trial days`;

export default function Coupons(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const [draft,setDraft]=useState<Draft|null>(null);
 const [error,setError]=useState('');
 const {data,isLoading}=useQuery({queryKey:['platform-coupons'],queryFn:platformApi.coupons});
 const plans=useQuery({queryKey:['platform-plans'],queryFn:platformApi.plans});
 const invalidate=()=>qc.invalidateQueries({queryKey:['platform-coupons']});

 const save=useMutation({
  mutationFn:(entry:Draft)=>entry._id?platformApi.updateCoupon(entry._id,toPayload(entry)):platformApi.createCoupon(toPayload(entry)),
  onSuccess:()=>{setDraft(null);setError('');invalidate()},
  onError:(problem:Error)=>setError(problem.message),
 });

 const toggle=useMutation({mutationFn:(row:CouponRow)=>platformApi.updateCoupon(row._id,{...toPayload(toDraft(row)),enabled:!row.enabled}),onSuccess:invalidate});

 const remove=useMutation({
  mutationFn:async(row:CouponRow)=>{
   const redeemed=row.redemptions>0;
   if(!await confirm({
    title:redeemed?`Disable ${row.code}?`:`Delete ${row.code}?`,
    description:redeemed?`It has been redeemed ${row.redemptions} times, so the code is kept on the record and only switched off.`:'It has never been redeemed, so it is removed entirely.',
    confirmLabel:redeemed?'Disable code':'Delete code',tone:'danger',
   }))throw new Error('Cancelled');
   return platformApi.deleteCoupon(row._id);
  },
  onSuccess:invalidate,
 });

 const manage=can('coupons.manage');
 const active=data?.filter(row=>!row.rejection).length||0;
 const redeemed=data?.reduce((total,row)=>total+row.redemptions,0)||0;
 return <div>
  <PageHeading eyebrow="Revenue" title="Coupons" copy="Discount codes with plan scope, redemption caps, and a validity window." actions={manage?<Button size="sm" onClick={()=>{setError('');setDraft({...blank})}}><Plus size={14}/> New code</Button>:<Status tone="info">Read-only for your role</Status>}/>

  <div className="platform-metrics">
   <StatCard label="Codes defined" value={data?.length||0} detail="Across every plan" tone="violet"/>
   <StatCard label="Redeemable now" value={active} detail="Enabled and inside their window" tone="green"/>
   <StatCard label="Total redemptions" value={redeemed} detail="Recorded against these codes" tone="blue"/>
   <StatCard label="Expiring codes" value={data?.filter(row=>row.validUntil).length||0} detail="Have an end date set" tone="amber"/>
  </div>

  <Panel title="Discount codes" copy="A code that cannot currently be redeemed says why">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Code</th><th>Discount</th><th>Plan scope</th><th>Redemptions</th><th>Window</th><th>Enabled</th><th /></tr></thead><tbody>
    {data?.map(row=><tr key={row._id}>
     <td><strong>{row.code}</strong><small>{row.description||'No description'}</small></td>
     <td><strong>{discountOf(row)}</strong><small>{row.recurringPeriods?`Repeats for ${row.recurringPeriods} periods`:'Applies once'}</small></td>
     <td>{row.planSlugs?.length?row.planSlugs.join(', '):'Any plan'}</td>
     <td>{row.redemptions.toLocaleString()}{row.maxRedemptions?` / ${row.maxRedemptions.toLocaleString()}`:''}</td>
     <td>{row.validFrom||row.validUntil?<>{dateOnly(row.validFrom)}<small>until {row.validUntil?dateOnly(row.validUntil):'further notice'}</small></>:'Always'}</td>
     <td>{row.rejection
      ?<Status tone="danger">{row.rejection}</Status>
      :<Toggle label={`Enable ${row.code}`} checked={row.enabled} disabled={!manage} onChange={()=>toggle.mutate(row)}/>}</td>
     <td><div className="platform-actions">
      {manage&&<Button variant="outline" size="sm" onClick={()=>{setError('');setDraft(toDraft(row))}}>Edit</Button>}
      {manage&&<Button variant="outline" size="sm" onClick={()=>remove.mutate(row)}><Trash2 size={13}/></Button>}
     </div></td>
    </tr>)}
   </tbody></table>
   {!isLoading&&!data?.length&&<div className="platform-empty"><Tags size={20}/>No discount codes yet.</div>}</div>
  </Panel>

  <Dialog open={Boolean(draft)} onOpenChange={next=>!next&&setDraft(null)}>
   <DialogContent className="border-(--pa-line-strong) bg-(--pa-panel) text-(--pa-text) sm:max-w-xl">
    <DialogHeader><DialogTitle>{draft?._id?'Edit code':'New discount code'}</DialogTitle></DialogHeader>
    {draft&&<div className="platform-form-grid">
     <Field label="Code" hint="Uppercase letters, numbers, dashes."><input value={draft.code} disabled={Boolean(draft._id)} onChange={event=>setDraft({...draft,code:event.target.value.toUpperCase()})} placeholder="LAUNCH20"/></Field>
     <Field label="Type"><select value={draft.type} onChange={event=>setDraft({...draft,type:event.target.value})}>{TYPES.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
     <Field label={draft.type==='PERCENT'?'Percent off':draft.type==='FIXED'?'Amount off':'Extra trial days'}><input type="number" min={0} value={draft.value} onChange={event=>setDraft({...draft,value:Number(event.target.value)})}/></Field>
     <Field label="Currency" hint="Only used for a fixed-amount discount."><input value={draft.currency} onChange={event=>setDraft({...draft,currency:event.target.value.toUpperCase()})}/></Field>
     <Field label="Description" wide><input value={draft.description} onChange={event=>setDraft({...draft,description:event.target.value})}/></Field>
     <Field label="Plan scope" hint={`Empty means any plan. Available: ${(plans.data||[]).map(plan=>plan.slug).join(', ')||'none yet'}`}><input value={draft.planSlugs} onChange={event=>setDraft({...draft,planSlugs:event.target.value})}/></Field>
     <Field label="Redemption cap" hint="0 means unlimited."><input type="number" min={0} value={draft.maxRedemptions} onChange={event=>setDraft({...draft,maxRedemptions:Number(event.target.value)})}/></Field>
     <Field label="Valid from"><input type="date" value={draft.validFrom} onChange={event=>setDraft({...draft,validFrom:event.target.value})}/></Field>
     <Field label="Valid until"><input type="date" value={draft.validUntil} onChange={event=>setDraft({...draft,validUntil:event.target.value})}/></Field>
     <Field label="Recurring periods" hint="0 applies the discount to one billing period."><input type="number" min={0} max={36} value={draft.recurringPeriods} onChange={event=>setDraft({...draft,recurringPeriods:Number(event.target.value)})}/></Field>
     <label style={{display:'flex',gap:7,alignItems:'center',fontSize:9,color:'var(--pa-body)'}}><input type="checkbox" checked={draft.enabled} onChange={event=>setDraft({...draft,enabled:event.target.checked})}/> Enabled</label>
     {error&&<p className="platform-banner danger" style={{gridColumn:'1 / -1'}}>{error}</p>}
     <Button disabled={save.isPending} onClick={()=>save.mutate(draft)} style={{gridColumn:'1 / -1'}}>{save.isPending?'Saving…':'Save code'}</Button>
    </div>}
   </DialogContent>
  </Dialog>
 </div>;
}
