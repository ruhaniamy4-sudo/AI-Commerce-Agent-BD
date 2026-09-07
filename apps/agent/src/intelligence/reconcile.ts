import {Conversation} from '../models/Conversation';
import {Message} from '../models/Message';
import {recordCustomerEvent} from './event-store';
import {messageEvents} from './message-events';
export async function reconcileCustomerMessages(customerId:string){
 const conversations=await Conversation.find({customerId}).select('conversationId customerId platform').lean();let count=0;
 for(const conversation of conversations){
  const messages=await Message.find({conversationId:conversation.conversationId}).sort({createdAt:1}).lean();
  for(const event of messageEvents(conversation,messages)){await recordCustomerEvent(event);count++;}
 }
 return count;
}
export async function projectConversation(conversationId:string){
 const conversation=await Conversation.findOne({conversationId}).lean();if(!conversation)return;
 const messages=await Message.find({conversationId}).sort({createdAt:1}).lean();
 for(const event of messageEvents(conversation,messages))await recordCustomerEvent(event);
}
