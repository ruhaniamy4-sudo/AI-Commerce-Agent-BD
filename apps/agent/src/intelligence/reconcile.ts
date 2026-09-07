import {Conversation} from '../models/Conversation';
import {Message} from '../models/Message';
import {recordCustomerEvent} from './event-store';
import {messageEvents} from './message-events';
import {Order} from '../models/Order';
import {orderEvents} from './order-events';
export async function reconcileCustomerOrders(customerId:string){
 const orders=await Order.find({customerId}).lean();
 for(const order of orders)for(const event of orderEvents(order))await recordCustomerEvent(event);
 return orders;
}
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
