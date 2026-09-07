import axios from 'axios';
import {BusinessChannel} from '../models/BusinessChannel';
import {Customer} from '../models/Customer';
import {Conversation} from '../models/Conversation';
import {WebhookEvent} from '../models/WebhookEvent';
import {requireTenantContext} from '../tenancy/context';
import {decryptMetaAccessToken} from '../services/meta-credentials.service';
import {processChatTurn} from '../services/chat-turn.service';
export async function sendWhatsApp(phoneNumberId:string,to:string,text:string){
 const {businessId}=requireTenantContext();
 const channel=await BusinessChannel.findOne({businessId,platform:'whatsapp',externalId:phoneNumberId,status:'active',connectionStatus:'CONNECTED'}).select('+encryptedAccessToken');
 if(!channel?.encryptedAccessToken)throw new Error('WhatsApp channel is not connected');
 const version=process.env.META_GRAPH_API_VERSION;
 if(!version||!/^v\d+\.\d+$/.test(version))throw new Error('META_GRAPH_API_VERSION is required');
 const response=await axios.post(`https://graph.facebook.com/${version}/${phoneNumberId}/messages`,{messaging_product:'whatsapp',to,type:'text',text:{body:text}}, {timeout:15000,headers:{Authorization:`Bearer ${decryptMetaAccessToken(channel.encryptedAccessToken)}`}});
 return response.data.messages?.[0]?.id;
}
export async function processWhatsAppMessage(data:{businessId:string;phoneNumberId:string;from:string;id:string;text:string;name:string}){
 const identity=`wa:${data.from}`;
 let customer=await Customer.findOne({psid:identity});
 if(!customer){const variants=[`+${data.from}`,data.from,...(data.from.startsWith('880')?['0'+data.from.slice(3)]:[])];const candidates=await Customer.find({phone:{$in:variants}}).limit(2);if(candidates.length===1){customer=candidates[0];await Customer.updateOne({_id:customer._id},{$set:{'metadata.phoneVerifiedBy':'whatsapp','metadata.whatsappId':data.from}});}}
 if(!customer){try{customer=await Customer.create({psid:identity,phone:`+${data.from}`,name:data.name,metadata:{phoneVerifiedBy:'whatsapp'}});}catch(error:any){if(error.code!==11000)throw error;customer=await Customer.findOne({psid:identity});}}
 if(!customer)throw new Error('WhatsApp identity unavailable');
 const conversationId=`wa_${data.phoneNumberId}_${data.from}`;
 await Conversation.findOneAndUpdate({conversationId},{$setOnInsert:{businessId:data.businessId,conversationId,customerId:customer._id,psid:data.from,platform:'whatsapp',platformPageId:data.phoneNumberId}},{upsert:true});
 const result=await processChatTurn({businessId:data.businessId,source:'whatsapp',conversationId,eventIdentifier:data.id,message:data.text});
 const reply=(result.body as any).reply;
 if(!reply)return;
 const conversation=await Conversation.findOne({conversationId});
 if(conversation?.controlMode!=='AI_ACTIVE')return;
 // Reserve once before transport. A network timeout needs operator reconciliation, never blind resend.
 // Transport reliability is independent of a customer's analytics opt-out.
 const eventId=`wa-outbound:${data.id}`;
 try{await WebhookEvent.updateOne({eventId},{$setOnInsert:{eventId,source:'whatsapp',eventType:'outbound',psid:data.from,payload:{delivery:'pending'}}},{upsert:true});}catch(error:any){if(error.code!==11000)throw error;}
 const claimed=await WebhookEvent.findOneAndUpdate({eventId,'payload.delivery':'pending'},{$set:{'payload.delivery':'sending'}},{new:true});
 if(!claimed)return;
 try{const providerId=await sendWhatsApp(data.phoneNumberId,data.from,reply);await WebhookEvent.updateOne({_id:claimed._id},{$set:{'payload.delivery':'sent','payload.providerId':providerId,processed:true,processedAt:new Date()}});}
 catch{await WebhookEvent.updateOne({_id:claimed._id},{$set:{'payload.delivery':'uncertain'}});throw new Error('WhatsApp delivery requires reconciliation');}
}
