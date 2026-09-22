'use client';
import {useMemo,useState} from 'react';
import {useMutation,useQuery,useQueryClient} from '@tanstack/react-query';
import {RotateCcw,Save} from 'lucide-react';
import {platformApi,type SettingRow} from '@/lib/platform-api';
import {Panel,Status,Toggle} from '@/components/platform/platform-ui';
import {useCan} from '@/components/platform/platform-session';
import {Button} from '@/components/ui/button';

/**
 * The console half of the settings registry.
 *
 * The agent declares every runtime setting — its type, its default, the group it
 * belongs to — and this renders the right control for each one. Adding a setting on
 * the server is therefore all it takes to make it editable here, and a value that
 * has never been written is shown as the default rather than as empty.
 */
export const settingsQuery = {queryKey:['platform-registry'],queryFn:platformApi.registry};

export function useSettings() { return useQuery<SettingRow[]>(settingsQuery); }

/** Reads one setting's effective value outside of the editor, for pages that act on it. */
export function useSettingValue<T>(key:string):T|undefined {
 const {data}=useSettings();
 return data?.find(row=>row.key===key)?.value as T|undefined;
}

const asText=(row:SettingRow,value:unknown)=>{
 if(row.type==='json')return JSON.stringify(value??row.default,null,2);
 if(row.type==='list')return Array.isArray(value)?value.join(', '):String(value??'');
 return value===undefined||value===null?'':String(value);
};

export function SettingsEditor({categories,title,copy,className}:{categories:string[];title:string;copy:string;className?:string}) {
 const can=useCan();
 const manage=can('settings.manage');
 const qc=useQueryClient();
 const {data,isLoading}=useSettings();
 const [drafts,setDrafts]=useState<Record<string,string|boolean>>({});
 const [problem,setProblem]=useState('');

 const save=useMutation({
  mutationFn:({row,value}:{row:SettingRow;value:unknown})=>platformApi.saveSetting(row.key,value),
  onSuccess:(_result,{row})=>{setProblem('');setDrafts(current=>{const next={...current};delete next[row.key];return next});qc.invalidateQueries({queryKey:['platform-registry']})},
  onError:(error:Error)=>setProblem(error.message),
 });

 const reset=useMutation({
  mutationFn:(row:SettingRow)=>platformApi.resetSetting(row.key),
  onSuccess:(_result,row)=>{setDrafts(current=>{const next={...current};delete next[row.key];return next});qc.invalidateQueries({queryKey:['platform-registry']})},
 });

 const rows=useMemo(()=>(data||[]).filter(row=>categories.includes(row.category)),[data,categories]);
 const groups=useMemo(()=>{
  const map=new Map<string,SettingRow[]>();
  for(const row of rows) map.set(row.group,[...(map.get(row.group)||[]),row]);
  return [...map.entries()];
 },[rows]);

 /** Turns the edited text back into the type the registry declared before it is sent. */
 function commit(row:SettingRow){
  const draft=drafts[row.key];
  const raw=draft===undefined?row.value:draft;
  try{
   const value=row.type==='boolean'?Boolean(raw)
    :row.type==='number'?Number(raw)
    :row.type==='list'?String(raw).split(',').map(entry=>entry.trim()).filter(Boolean)
    :row.type==='json'?JSON.parse(String(raw))
    :String(raw);
   save.mutate({row,value});
  }catch{
   setProblem(`${row.label} is not valid JSON`);
  }
 }

 return <Panel title={title} copy={copy} className={className} action={manage?<Status tone="success">Writes are audited</Status>:<Status tone="info">Read-only for your role</Status>}>
  {problem&&<p className="platform-banner danger">{problem}</p>}
  {isLoading&&<div className="platform-empty">Loading configuration…</div>}
  {groups.map(([group,items])=><section key={group}>
   <p className="platform-group-title">{group}</p>
   {items.map(row=>{
    const dirty=drafts[row.key]!==undefined;
    const current=dirty?drafts[row.key]:row.value;
    return <div className={`platform-setting${dirty?' is-dirty':''}`} key={row.key}>
     <div className="platform-setting-copy">
      <strong>{row.label}{row.unit?` (${row.unit})`:''}</strong>
      <p>{row.description}</p>
      <code>{row.key}{row.isDefault?' · default':''}</code>
     </div>
     <div className="platform-setting-control">
      {row.type==='boolean'
       ?<Toggle label={row.label} checked={Boolean(current)} disabled={!manage} onChange={value=>{setDrafts({...drafts,[row.key]:value});save.mutate({row,value})}}/>
       :row.type==='select'
        ?<select value={String(current??'')} disabled={!manage} onChange={event=>setDrafts({...drafts,[row.key]:event.target.value})}>{(row.options||[]).map(option=><option key={option} value={option}>{option.replaceAll('_',' ')}</option>)}</select>
        :row.type==='text'||row.type==='json'
         ?<textarea value={asText(row,current)} disabled={!manage} onChange={event=>setDrafts({...drafts,[row.key]:event.target.value})}/>
         :<input type={row.type==='number'?'number':'text'} value={asText(row,current)} disabled={!manage} onChange={event=>setDrafts({...drafts,[row.key]:event.target.value})}/>}
      {manage&&row.type!=='boolean'&&<Button size="sm" variant="outline" disabled={!dirty||save.isPending} onClick={()=>commit(row)} aria-label={`Save ${row.label}`}><Save size={13}/></Button>}
      {manage&&!row.isDefault&&<Button size="sm" variant="outline" onClick={()=>reset.mutate(row)} aria-label={`Reset ${row.label}`}><RotateCcw size={13}/></Button>}
     </div>
    </div>;
   })}
  </section>)}
  {!isLoading&&!rows.length&&<div className="platform-empty">No settings in this section yet.</div>}
 </Panel>;
}
