import axios from 'axios';
import {BusinessChannel} from '../models/BusinessChannel';
import {Customer} from '../models/Customer';
import {Conversation} from '../models/Conversation';
import {CustomerEvent} from '../models/CustomerEvent';
import {requireTenantContext} from '../tenancy/context';
import {decryptMetaAccessToken} from '../services/meta-credentials.service';
import {processChatTurn} from '../services/chat-turn.service';
import {recordCustomerEvent} from './event-store';
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
 const event=await recordCustomerEvent({type:'message_sent',source:'whatsapp-transport',externalId:data.id,customerId:String(customer._id),conversationId,verified:true,data:{delivery:'pending'}});
 const claimed=await CustomerEvent.findOneAndUpdate({_id:event!._id,'data.delivery':'pending'},{$set:{'data.delivery':'sending'}},{new:true});
 if(!claimed)return;
 try{const providerId=await sendWhatsApp(data.phoneNumberId,data.from,reply);await CustomerEvent.updateOne({_id:event!._id},{$set:{'data.delivery':'sent','data.providerId':providerId}});}
 catch{await CustomerEvent.updateOne({_id:event!._id},{$set:{'data.delivery':'uncertain'}});throw new Error('WhatsApp delivery requires reconciliation');}
}
