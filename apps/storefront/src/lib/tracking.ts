const base=`${process.env.NEXT_PUBLIC_API_URL||process.env.NEXT_PUBLIC_API_BASE_URL||'http://localhost:4000'}/public/${encodeURIComponent(process.env.NEXT_PUBLIC_BUSINESS_CHANNEL_ID||'storefront')}/tracking`;
const key='sellpilot-visit';let pending:Promise<string|null>|undefined;
export function visitToken(){try{return localStorage.getItem(key);}catch{return null;}}
export async function trackCustomer(type:string,data:Record<string,string>={}){
 if(typeof window==='undefined'||navigator.doNotTrack==='1')return;
 try{
  if(!pending)pending=fetch(`${base}/session`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:visitToken()})}).then(async r=>{if(!r.ok)throw new Error('Tracking unavailable');const value=await r.json();localStorage.setItem(key,value.token);return value.token;}).catch(()=>{pending=undefined;return null;});
  const token=await pending;if(!token)return;
  await fetch(`${base}/events`,{method:'POST',headers:{'Content-Type':'application/json'},keepalive:true,body:JSON.stringify({type,data,token,eventId:crypto.randomUUID()})});
 }catch{/* Browsing and checkout remain available if analytics is offline. */}
}
