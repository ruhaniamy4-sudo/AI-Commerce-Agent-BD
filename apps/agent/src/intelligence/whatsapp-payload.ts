import crypto from 'node:crypto';
export function validMetaSignature(raw:Buffer|undefined,signature:unknown,secret:string|undefined){
 if(!raw||!secret||typeof signature!=='string'||!/^sha256=[a-f0-9]{64}$/.test(signature))return false;
 return crypto.timingSafeEqual(Buffer.from(signature.slice(7),'hex'),crypto.createHmac('sha256',secret).update(raw).digest());
}
export function whatsappMessages(body:any){
 if(body?.object!=='whatsapp_business_account')return [];
 const result:Array<{phoneNumberId:string;from:string;id:string;text:string;name:string}> = [];
 for(const entry of body.entry||[])for(const change of entry.changes||[]){const value=change.value;const phoneNumberId=value?.metadata?.phone_number_id;if(!/^\d+$/.test(phoneNumberId||''))continue;
  for(const message of value.messages||[]){if(!message.id||!/^\d{8,15}$/.test(message.from||'')||message.type!=='text'||typeof message.text?.body!=='string')continue;
   result.push({phoneNumberId,from:message.from,id:String(message.id).slice(0,200),text:message.text.body.slice(0,4000),name:String(value.contacts?.find((c:any)=>c.wa_id===message.from)?.profile?.name||'WhatsApp customer').slice(0,120)});
  }
 }return result;
}
