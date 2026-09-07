import {EventInput,isSandboxConversation} from './events';
export function messageEvents(conversation:any,messages:any[]):EventInput[]{
 if(!conversation.customerId||conversation.platform==='manual'||isSandboxConversation(conversation.conversationId))return [];
 let previousInbound:Date|undefined;
 return messages.flatMap(message=>{
  if(!['user','assistant'].includes(message.role))return [];
  const at=new Date(message.createdAt);const inbound=message.role==='user';
  const responseMs=!inbound&&previousInbound?Math.max(0,at.getTime()-previousInbound.getTime()):undefined;
  if(inbound)previousInbound=at;else previousInbound=undefined;
  const data={text:String(message.content||'').slice(0,2000),intent:message.metadata?.intent,products:message.metadata?.products||[],handledBy:message.metadata?.source==='human'?'human':'ai',...(responseMs!==undefined?{responseMs}:{})};
  const base={source:conversation.platform||'web-widget',customerId:String(conversation.customerId),conversationId:conversation.conversationId,externalId:String(message._id),occurredAt:at,verified:true,data};
  const events:EventInput[]=[{...base,type:inbound?'message_received':'message_sent'}];
  if(inbound&&/\b(return|refund|support|complaint|warranty)\b|ফেরত|অভিযোগ/i.test(message.content))events.push({...base,type:'support_request'});
  return events;
 });
}
