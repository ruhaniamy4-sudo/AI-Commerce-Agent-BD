import {beforeEach,describe,expect,it,vi} from 'vitest';
import {processChatTurn} from './chat-turn.service';
import {evaluateBusinessAIAccess} from './business-ai-access.service';
import {getDeterministicResponse} from './deterministic-response.service';
import {customerFallbackMessage,notifyMerchantOfBlock} from './ai-access-messaging.service';
import {saveMessage} from './memory.service';
import {agentGraph} from '../agent/graph';
import {AIUsage} from '../models/AIUsage';

vi.mock('./business-ai-access.service',()=>({evaluateBusinessAIAccess:vi.fn()}));
vi.mock('./deterministic-response.service',()=>({getDeterministicResponse:vi.fn()}));
vi.mock('./inbound-idempotency.service',()=>({registerInboundEvent:vi.fn(),claimInboundEvent:vi.fn().mockResolvedValue({claimed:true,processingToken:'token',event:{}}),completeInboundEvent:vi.fn(),checkpointInboundEvent:vi.fn(),releaseInboundEvent:vi.fn()}));
vi.mock('./memory.service',()=>({ensureConversation:vi.fn().mockResolvedValue({conversationId:'c',controlMode:'AI_ACTIVE',psid:'p'}),saveMessage:vi.fn()}));
vi.mock('./conversation-control.service',()=>({isAIActive:vi.fn().mockReturnValue(true),invokeIfAIActive:vi.fn(async(_id:string,work:()=>Promise<any>)=>work())}));
vi.mock('./agentManager',()=>({getAgentStatus:vi.fn().mockResolvedValue('active'),updateLastHumanActivity:vi.fn()}));
vi.mock('./history.service',()=>({loadConversationHistory:vi.fn().mockResolvedValue([])}));
vi.mock('./image-processor.service',()=>({handleImageInput:vi.fn()}));
vi.mock('./agent-action.service',()=>({executeAgentAction:vi.fn(),parseAgentResponse:vi.fn()}));
vi.mock('./turn-metrics.service',()=>({recordConversationTurn:vi.fn()}));
vi.mock('../agent/graph',()=>({agentGraph:{invoke:vi.fn()}}));
vi.mock('./ai-access-messaging.service',()=>({customerFallbackMessage:vi.fn().mockReturnValue('Holding reply'),notifyMerchantOfBlock:vi.fn().mockResolvedValue(true)}));

describe('chat pipeline business AI kill switch',()=>{beforeEach(()=>{vi.clearAllMocks()});
 it('stores Business A inbound message and answers with a holding reply, without generating, while suspended',async()=>{vi.mocked(evaluateBusinessAIAccess).mockResolvedValue({allowed:false,reason:'PLATFORM_SUSPENDED',pausedReply:'Back Monday'});const usage=vi.spyOn(AIUsage,'findOneAndUpdate');const result=await processChatTurn({businessId:'business-a',conversationId:'c-a',eventIdentifier:'e-a',message:'price koto?'});
  // No LLM work, but the customer is answered and the merchant is told once.
  expect(result).toMatchObject({status:202,body:{reply:'Holding reply',aiAccess:'PLATFORM_SUSPENDED'}});
  expect(customerFallbackMessage).toHaveBeenCalledWith(expect.any(String),'Back Monday');
  expect(saveMessage).toHaveBeenCalledWith('business-a','c-a','assistant','Holding reply',undefined,expect.objectContaining({messageId:'e-a:assistant'}));
  expect(notifyMerchantOfBlock).toHaveBeenCalledWith('business-a','PLATFORM_SUSPENDED',expect.objectContaining({reason:'PLATFORM_SUSPENDED'}));
  expect(getDeterministicResponse).not.toHaveBeenCalled();expect(agentGraph.invoke).not.toHaveBeenCalled();expect(usage).not.toHaveBeenCalled()});
 it('allows an unaffected or resumed Business B future message',async()=>{vi.mocked(evaluateBusinessAIAccess).mockResolvedValue({allowed:true});vi.mocked(getDeterministicResponse).mockResolvedValue('Canonical reply');const result=await processChatTurn({businessId:'business-b',conversationId:'c-b',eventIdentifier:'e-b',message:'price koto?'});expect(result).toMatchObject({status:200,body:{reply:'Canonical reply',deterministic:true}});expect(evaluateBusinessAIAccess).toHaveBeenCalledWith('business-b')});
});
