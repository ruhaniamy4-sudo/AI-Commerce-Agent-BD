'use client';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {PauseCircle,PlayCircle,RefreshCw,Timer,Trash2,TriangleAlert} from 'lucide-react';
import {platformApi,type QueueRow} from '@/lib/platform-api';
import {PageHeading,Panel,StatCard,Status,dateTime} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {useConfirm} from '@/components/ui/confirm-dialog';
import {Button} from '@/components/ui/button';

const STATES=['waiting','active','delayed','failed','completed','paused'];
const CONSEQUENCES:Record<string,string>={
 retry:'Every failed job is put back on the queue and processed again.',
 drain:'Waiting and delayed jobs are discarded. Work already queued will not run.',
 clean:'Failed jobs are removed from the queue and cannot be retried afterwards.',
 pause:'The queue stops handing work to workers. Nothing is lost; it accumulates.',
 resume:'Workers start taking jobs again.',
};

export default function Jobs(){
 const confirm=useConfirm();
 const can=useCan();
 const qc=useQueryClient();
 const {data,isLoading}=useQuery({queryKey:['platform-jobs'],queryFn:platformApi.jobs,refetchInterval:15000});

 const act=useMutation({
  mutationFn:async({queue,action}:{queue:QueueRow;action:string})=>{
   const destructive=['drain','clean'].includes(action);
   const why=await confirm({
    title:`${action[0].toUpperCase()}${action.slice(1)} the ${queue.name} queue?`,
    description:CONSEQUENCES[action],
    confirmLabel:`${action[0].toUpperCase()}${action.slice(1)}`,
    tone:destructive?'danger':'warning',
    reason:{label:'Reason (kept in the audit log)',placeholder:'Why this is needed'},
   });
   if(!why)throw new Error('Cancelled');
   return platformApi.runQueueAction(queue.name,action,why);
  },
  onSuccess:()=>qc.invalidateQueries({queryKey:['platform-jobs']}),
 });

 const manage=can('ops.manage');
 const totals=(data?.queues||[]).reduce((sum,queue)=>({
  waiting:sum.waiting+(queue.counts.waiting||0),
  active:sum.active+(queue.counts.active||0),
  failed:sum.failed+(queue.counts.failed||0),
  completed:sum.completed+(queue.counts.completed||0),
 }),{waiting:0,active:0,failed:0,completed:0});

 return <div>
  <PageHeading eyebrow="Operations" title="Background jobs" copy="Webhook processing and courier synchronisation: depth, failures, and the controls to clear them." actions={<Status tone={data?.redisConfigured?'success':'warning'}>{data?.redisConfigured?'Redis configured':'Redis not configured'}</Status>}/>

  {data&&!data.redisConfigured&&<p className="platform-banner"><TriangleAlert size={14}/>This deployment runs without Redis, so queue-backed features are unavailable. Requests that need a queue fail explicitly rather than dropping work.</p>}

  <div className="platform-metrics">
   <StatCard label="Waiting" value={totals.waiting} detail="Queued and not yet started" tone="violet"/>
   <StatCard label="Active" value={totals.active} detail="Being processed now" tone="blue"/>
   <StatCard label="Failed" value={totals.failed} detail="Needs a retry or investigation" tone="amber"/>
   <StatCard label="Completed" value={totals.completed} detail="Retained by the queue" tone="green"/>
  </div>

  {(data?.queues||[]).map(queue=><Panel key={queue.name} title={queue.name} copy={queue.available?`${queue.paused?'Paused':'Running'} · refreshed every 15 seconds`:queue.error||'Queue unavailable'} className="mt-4" action={manage&&queue.available?<div className="platform-actions">
   <Button variant="outline" size="sm" onClick={()=>act.mutate({queue,action:'retry'})}><RefreshCw size={13}/> Retry failed</Button>
   <Button variant="outline" size="sm" onClick={()=>act.mutate({queue,action:queue.paused?'resume':'pause'})}>{queue.paused?<><PlayCircle size={13}/> Resume</>:<><PauseCircle size={13}/> Pause</>}</Button>
   <Button variant="outline" size="sm" onClick={()=>act.mutate({queue,action:'clean'})}><Trash2 size={13}/> Clear failed</Button>
   <Button variant="outline" size="sm" onClick={()=>act.mutate({queue,action:'drain'})}>Drain</Button>
  </div>:<Status tone={queue.available?'success':'danger'}>{queue.available?'Reachable':'Unreachable'}</Status>}>
   {queue.available?<>
    <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr>{STATES.map(state=><th key={state}>{state}</th>)}</tr></thead><tbody><tr>{STATES.map(state=><td key={state}><strong>{(queue.counts[state]||0).toLocaleString()}</strong></td>)}</tr></tbody></table></div>
    {queue.failures.length>0&&<><p className="platform-group-title">Recent failures</p>
     <ul className="platform-activity">{queue.failures.map(failure=><li key={failure.id}>
      <i><TriangleAlert size={13}/></i>
      <div><strong>{failure.name||'job'} · {failure.attempts} attempts</strong><span>{failure.failedReason||'No reason recorded'}</span></div>
      <time>{dateTime(failure.timestamp)}</time>
     </li>)}</ul></>}
   </>:<div className="platform-empty"><Timer size={20}/>{queue.error||'This queue cannot be reached.'}</div>}
  </Panel>)}

  {isLoading&&<div className="platform-empty">Loading queues…</div>}
 </div>;
}
