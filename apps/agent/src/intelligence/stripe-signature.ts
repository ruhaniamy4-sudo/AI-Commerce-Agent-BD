import crypto from 'node:crypto';
export function validStripeSignature(raw:Buffer|undefined,header:unknown,secret:string,now=Date.now()){
 if(!raw||typeof header!=='string'||!secret)return false;const parts=header.split(',');const timestamp=parts.find(p=>p.startsWith('t='))?.slice(2);if(!timestamp||!/^\d+$/.test(timestamp)||Math.abs(now/1000-Number(timestamp))>300)return false;
 const expected=crypto.createHmac('sha256',secret).update(timestamp+'.').update(raw).digest();
 return parts.filter(p=>p.startsWith('v1=')).some(p=>{const value=p.slice(3);return /^[a-f0-9]{64}$/.test(value)&&crypto.timingSafeEqual(expected,Buffer.from(value,'hex'));});
}
