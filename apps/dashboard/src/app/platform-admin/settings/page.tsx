'use client';
import {useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {CreditCard,Flag,Globe2,PlugZap,Save,type LucideIcon} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {PageHeading,Panel,Status} from '@/components/platform/platform-ui';
import {Button} from '@/components/ui/button';

type SettingItem={key:string;value:unknown;category:string;description:string};
const defaults:SettingItem[]=[
 {key:'platform.maintenance_mode',value:false,category:'platform',description:'Limit merchant access during planned maintenance'},
 {key:'billing.invoice_prefix',value:'SP',category:'billing',description:'Prefix used for newly issued invoice numbers'},
 {key:'subscription.allow_self_serve',value:true,category:'subscription',description:'Allow merchants to initiate plan changes'},
 {key:'feature.whatsapp_channel',value:false,category:'feature',description:'Expose the WhatsApp channel to eligible plans'},
];
const groups:Array<{title:string;Icon:LucideIcon;category:string}>=[
 {title:'Platform & access',Icon:Globe2,category:'platform'},
 {title:'Billing',Icon:CreditCard,category:'billing'},
 {title:'Subscriptions & flags',Icon:Flag,category:'subscription'},
 {title:'Integrations',Icon:PlugZap,category:'integration'},
];

export default function Settings(){
 const qc=useQueryClient();
 const query=useQuery({queryKey:['platform-settings'],queryFn:platformApi.settings});
 const [draft,setDraft]=useState<Record<string,unknown>>({});
 const save=useMutation({mutationFn:(item:SettingItem)=>platformApi.updateSetting(item.key,{...item,value:draft[item.key]??item.value}),onSuccess:()=>qc.invalidateQueries({queryKey:['platform-settings']})});
 const values=new Map(query.data?.map(x=>[x.key,x.value]));
 return <div><PageHeading eyebrow="Operations" title="Platform settings" copy="Control billing behavior, subscription policy, integrations, and feature availability." actions={<Status tone="success">Configuration audited</Status>}/><div className="platform-grid equal">{groups.map(({title,Icon,category})=>{const items=defaults.filter(x=>x.category===category||(category==='subscription'&&x.category==='feature'));return <Panel key={title} title={title} copy="Changes are written to the platform audit log"><div className="platform-form-grid">{items.map(item=>{const current=draft[item.key]??values.get(item.key)??item.value;return <div className="platform-form-field" style={{gridColumn:'1 / -1'}} key={item.key}><label>{item.key}</label><div style={{display:'flex',gap:8}}>{typeof current==='boolean'?<select value={String(current)} onChange={e=>setDraft({...draft,[item.key]:e.target.value==='true'})}><option value="true">Enabled</option><option value="false">Disabled</option></select>:<input value={String(current)} onChange={e=>setDraft({...draft,[item.key]:e.target.value})}/>}<Button size="sm" variant="outline" onClick={()=>save.mutate({...item,value:current})}><Save size={13}/></Button></div><small style={{color:'#646c88',fontSize:9}}>{item.description}</small></div>})}{!items.length&&<div className="platform-empty" style={{gridColumn:'1 / -1'}}><Icon size={18}/>No configurable integration values have been added.</div>}</div></Panel>})}</div></div>
}
