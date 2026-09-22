'use client';
import {useQuery} from '@tanstack/react-query';
import {Bot,CircleAlert,Cpu,TriangleAlert} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {ExportLink,PageHeading,Panel,StatCard,Status,percent} from '@/components/platform/platform-ui';
import {SettingsEditor} from '@/components/platform/settings-registry';

const usd=(value?:number|null)=>value==null?'—':`$${value.toFixed(4)}`;

export default function AiConfig(){
 const {data,isLoading}=useQuery({queryKey:['platform-ai-overview'],queryFn:platformApi.aiOverview,refetchInterval:60000});
 const ceiling=data?.ceiling;
 const over=Boolean(ceiling?.limit&&ceiling.percent!=null&&ceiling.percent>=(ceiling.warnAt||80));
 const configured=data?.runtime.provider==='openai'?data?.runtime.openAiConfigured:data?.runtime.groqConfigured;

 return <div>
  <PageHeading eyebrow="AI & intelligence" title="Model & routing" copy="Which provider and model serve merchant conversations, what each workspace is allowed, and what the platform is spending." actions={<>
   <Status tone={configured?'success':'danger'}>{configured?`${data?.runtime.provider} credentials present`:'Provider credentials missing'}</Status>
   <ExportLink href={platformApi.exportUrl('usage','this_month')} label="Export usage"/>
  </>}/>

  {ceiling?.limit&&over&&<p className="platform-banner"><TriangleAlert size={14}/>AI spend is at {percent(ceiling.percent)} of the ${ceiling.limit} monthly ceiling. The configured behaviour applies once it is reached.</p>}
  {!configured&&<p className="platform-banner danger"><CircleAlert size={14}/>The active provider has no API key in the environment. Merchant AI replies will fail until it is set.</p>}

  <Panel title="Live routing" copy="The provider and its credentials come from the deployment; the model and the reply ceiling can be overridden here">
   <div className="platform-kv">
    <div><dt>Provider</dt><dd>{data?.runtime.provider||'—'}</dd></div>
    <div><dt>Deployment model</dt><dd>{data?.runtime.deploymentModel||'—'}</dd></div>
    <div><dt>Model in use</dt><dd>{data?.runtime.effectiveModel||'—'}{data&&data.runtime.effectiveModel!==data.runtime.deploymentModel?' · overridden below':''}</dd></div>
    <div><dt>Max tokens per reply</dt><dd>{data?.runtime.maxOutputTokens?.toLocaleString()||'—'}</dd></div>
   </div>
  </Panel>

  <div className="platform-metrics">
   <StatCard label="Requests this month" value={data?.month.requests||0} detail="Across every workspace" tone="violet"/>
   <StatCard label="Tokens this month" value={(data?.month.totalTokens||0).toLocaleString()} detail="Input and output combined" tone="blue"/>
   <StatCard label="Estimated spend" value={usd(data?.month.knownCost)} detail={ceiling?.limit?`Ceiling $${ceiling.limit}`:'No ceiling set'} tone="green"/>
   <StatCard label="AI-enabled workspaces" value={data?.states.ENABLED||0} detail={`${data?.states.SUSPENDED_BY_PLATFORM||0} suspended by platform`} tone="amber"/>
  </div>

  {ceiling?.limit?<Panel title="Monthly cost ceiling" copy="Estimated spend against the configured platform ceiling">
   <div className={`platform-meter${over?' warn':''}`}><span style={{width:`${Math.min(100,ceiling.percent||0)}%`}}/></div>
   <p style={{marginTop:9,color:'var(--pa-muted)',fontSize:9}}>{usd(ceiling.spend)} of ${ceiling.limit} · warning at {ceiling.warnAt}%</p>
  </Panel>:null}

  <div className="platform-grid equal" style={{marginTop:15}}>
   <Panel title="Spend by model" copy="Where this month's requests actually went">
    <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Provider</th><th>Model</th><th>Requests</th><th>Tokens</th><th>Cost</th></tr></thead><tbody>
     {data?.byModel.map(row=><tr key={`${row._id.provider}-${row._id.model}`}>
      <td><strong>{row._id.provider}</strong></td>
      <td>{row._id.model||'Unknown'}</td>
      <td>{row.requests.toLocaleString()}</td>
      <td>{row.tokens.toLocaleString()}</td>
      <td>{usd(row.cost)}</td>
     </tr>)}
    </tbody></table>
    {!isLoading&&!data?.byModel.length&&<div className="platform-empty"><Cpu size={20}/>No AI requests recorded this month.</div>}</div>
   </Panel>
   <Panel title="Highest-cost workspaces" copy="This month, by estimated spend">
    <ul className="platform-activity">{data?.topBusinesses.map(row=><li key={row._id}>
     <i><Bot size={13}/></i>
     <div><strong>{row.businessName}</strong><span>{row.requests.toLocaleString()} requests · {row.tokens.toLocaleString()} tokens</span></div>
     <b>{usd(row.cost)}</b>
    </li>)}</ul>
    {!isLoading&&!data?.topBusinesses.length&&<div className="platform-empty">No workspace has used AI this month.</div>}
   </Panel>
  </div>

  <SettingsEditor className="mt-4" categories={['ai']} title="AI configuration" copy="Routing, quotas, and capability switches. Quotas here are the fallback when a plan and a workspace both set none."/>
 </div>;
}
