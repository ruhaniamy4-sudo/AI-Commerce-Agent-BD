'use client';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {KeyRound,PlugZap,ShieldAlert} from 'lucide-react';
import {platformApi,type ProviderRow} from '@/lib/platform-api';
import {PageHeading,Panel,Status,Toggle} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';

/**
 * Whether a channel or courier exists platform-wide, next to whether the
 * credentials it needs are actually present. Switching one off hides it from every
 * merchant without touching the connections they have already made.
 */
export default function Providers(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const {data,isLoading}=useQuery({queryKey:['platform-providers'],queryFn:platformApi.providers});

 const toggle=useMutation({
  mutationFn:async({row,next}:{row:ProviderRow;next:boolean})=>{
   if(!next&&row.connected>0&&!await confirm({
    title:`Switch off ${row.label}?`,
    description:`${row.connected} workspace${row.connected===1?'' : 's'} currently use it. Existing connections stay in the database but the provider stops being offered.`,
    confirmLabel:'Switch off',tone:'warning',
   }))throw new Error('Cancelled');
   return platformApi.saveSetting(row.settingKey,next);
  },
  onSuccess:()=>{qc.invalidateQueries({queryKey:['platform-providers']});qc.invalidateQueries({queryKey:['platform-registry']})},
 });

 const manage=can('integrations.manage');
 const infrastructure=data?.infrastructure;
 const rows=(items:ProviderRow[]|undefined)=>(items||[]).map(row=><tr key={row.id}>
  <td><strong>{row.label}</strong><small><code>{row.settingKey}</code></small></td>
  <td>{row.credentials?<Status tone="success">Configured</Status>:<Status tone="danger">Credentials missing</Status>}</td>
  <td>{row.connected.toLocaleString()} of {row.total.toLocaleString()}</td>
  <td><Toggle label={`Offer ${row.label}`} checked={row.enabled} disabled={!manage} onChange={next=>toggle.mutate({row,next})}/></td>
 </tr>);

 return <div>
  <PageHeading eyebrow="Channels" title="Providers" copy="Which channels and couriers the platform offers, and whether their credentials are in place." actions={<Status tone={infrastructure?.sandbox?'warning':'success'}>{infrastructure?.sandbox?'Sandbox mode':'Production mode'}</Status>}/>

  {data&&!data.infrastructure.ai.groq&&!data.infrastructure.ai.openai&&<p className="platform-banner danger"><ShieldAlert size={14}/>No AI provider key is configured, so merchant replies cannot be generated.</p>}

  <div className="platform-grid equal">
   <Panel title="Channels" copy="Switching a channel off removes it from merchant onboarding">
    <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Channel</th><th>Credentials</th><th>Connected</th><th>Offered</th></tr></thead><tbody>{rows(data?.channels)}</tbody></table>
    {isLoading&&<div className="platform-empty">Loading providers…</div>}</div>
   </Panel>
   <Panel title="Couriers" copy="Delivery partners available to merchants">
    <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Courier</th><th>Credentials</th><th>Connected</th><th>Offered</th></tr></thead><tbody>{rows(data?.couriers)}</tbody></table></div>
   </Panel>
  </div>

  <Panel title="Infrastructure" copy="What the running deployment actually has configured" className="mt-4">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Dependency</th><th>State</th><th>Why it matters</th></tr></thead><tbody>
    <tr><td><strong>Groq</strong></td><td>{infrastructure?.ai.groq?<Status tone="success">Configured</Status>:<Status tone="neutral">Not configured</Status>}</td><td>Primary AI provider for merchant conversations</td></tr>
    <tr><td><strong>OpenAI</strong></td><td>{infrastructure?.ai.openai?<Status tone="success">Configured</Status>:<Status tone="neutral">Not configured</Status>}</td><td>Alternative provider and fallback routing</td></tr>
    <tr><td><strong>Media storage</strong></td><td>{infrastructure?.storage?<Status tone="success">Configured</Status>:<Status tone="warning">Not configured</Status>}</td><td>Product images and customer media uploads</td></tr>
    <tr><td><strong>Email delivery</strong></td><td>{infrastructure?.email?<Status tone="success">Configured</Status>:<Status tone="warning">Not configured</Status>}</td><td>Verification, password reset, and announcements</td></tr>
    <tr><td><strong>Redis</strong></td><td>{infrastructure?.redis?<Status tone="success">Configured</Status>:<Status tone="warning">Not configured</Status>}</td><td>Background jobs, webhook processing, courier sync</td></tr>
   </tbody></table></div>
  </Panel>

  <p className="platform-banner info" style={{marginTop:15}}><KeyRound size={14}/>Provider secrets stay in the deployment environment and are never shown or editable here — this page reports only whether they are present.</p>
  <p style={{marginTop:10,color:'var(--pa-muted)',fontSize:9}}><PlugZap size={11}/> Sandbox mode and webhook retry behaviour are in Settings → Integrations.</p>
 </div>;
}
