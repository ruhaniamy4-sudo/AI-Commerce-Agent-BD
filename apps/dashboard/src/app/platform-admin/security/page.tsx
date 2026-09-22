'use client';
import {useQuery} from '@tanstack/react-query';
import {KeyRound,ShieldCheck,UserCog} from 'lucide-react';
import {platformApi} from '@/lib/platform-api';
import {ExportLink,PageHeading,Panel,StatCard,Status,dateTime,since} from '@/components/platform/platform-ui';
import {SettingsEditor,useSettingValue} from '@/components/platform/settings-registry';

/**
 * Who has console access, how recently they used it, and the policy that governs
 * sign-in. The sensitive-event feed is the subset of the audit log an operator
 * should notice without going looking for it.
 */
export default function Security(){
 const {data,isLoading}=useQuery({queryKey:['platform-security'],queryFn:platformApi.security});
 const allowlist=useSettingValue<string[]>('security.admin_ip_allowlist')||[];
 const lockout=useSettingValue<number>('security.admin_login_lockout_attempts');
 const minLength=useSettingValue<number>('security.password_min_length');

 const admins=data?.admins||[];
 const active=admins.filter(admin=>admin.status==='active').length;
 const dormant=admins.filter(admin=>admin.status==='active'&&!admin.lastLoginAt).length;
 const mustChange=admins.filter(admin=>admin.mustChangePassword).length;

 return <div>
  <PageHeading eyebrow="Governance" title="Security" copy="Console access, sign-in policy, and the changes worth noticing." actions={<>
   <Status tone={allowlist.length?'success':'neutral'}>{allowlist.length?`${allowlist.length} allowlisted addresses`:'No IP allowlist'}</Status>
   <ExportLink href={platformApi.exportUrl('audit','12m')} label="Export audit"/>
  </>}/>

  <div className="platform-metrics">
   <StatCard label="Active administrators" value={active} detail={`${admins.length-active} disabled`} tone="violet"/>
   <StatCard label="Never signed in" value={dormant} detail="Active accounts with no sign-in recorded" tone="amber"/>
   <StatCard label="Pending password change" value={mustChange} detail="Given a temporary password" tone="blue"/>
   <StatCard label="Merchant users today" value={data?.activeMerchantUsers24h||0} detail="Seen in the last 24 hours" tone="green"/>
  </div>

  <Panel title="Console access" copy="Sign-in activity over the last 30 days">
   <div className="platform-table-wrap"><table className="platform-data-table"><thead><tr><th>Administrator</th><th>Role</th><th>Status</th><th>Sign-ins (30d)</th><th>Last sign-in</th><th>Password</th></tr></thead><tbody>
    {admins.map(admin=><tr key={admin._id}>
     <td><strong>{admin.name}</strong><small>{admin.email}</small></td>
     <td><Status tone={admin.role==='OWNER'?'info':'neutral'}>{admin.role}</Status></td>
     <td><Status tone={admin.status==='active'?'success':'danger'}>{admin.status}</Status></td>
     <td>{admin.logins30d}</td>
     <td>{admin.lastLoginAt?<>{dateTime(admin.lastLoginAt)}<small>{since(admin.lastLoginAt)} ago</small></>:<Status tone="warning">Never</Status>}</td>
     <td>{admin.mustChangePassword?<Status tone="warning">Must change</Status>:<Status tone="success">Set</Status>}</td>
    </tr>)}
   </tbody></table>
   {isLoading&&<div className="platform-empty">Loading access records…</div>}</div>
  </Panel>

  <Panel title="Sensitive changes" copy="Administrator, session, and erasure events from the last 30 days" className="mt-4">
   <ul className="platform-activity">{(data?.sensitiveEvents||[]).map(event=><li key={event._id}>
    <i>{event.action.includes('PASSWORD')?<KeyRound size={13}/>:event.action.includes('ADMIN')?<UserCog size={13}/>:<ShieldCheck size={13}/>}</i>
    <div><strong>{event.action.replaceAll('_',' ')}</strong><span>{event.reason}</span></div>
    <time>{since(event.createdAt)}</time>
   </li>)}</ul>
   {!isLoading&&!data?.sensitiveEvents.length&&<div className="platform-empty">No sensitive changes recorded in the last 30 days.</div>}
  </Panel>

  <SettingsEditor className="mt-4" categories={['security']} title="Access policy" copy={`Passwords currently need at least ${minLength||10} characters, and ${lockout||5} failed sign-ins lock an administrator account.`}/>
 </div>;
}
