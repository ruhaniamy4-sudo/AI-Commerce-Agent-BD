import {beforeEach,describe,expect,it,vi} from 'vitest';
import {processChatTurn} from './chat-turn.service';
import {evaluateBusinessAIAccess} from './business-ai-access.service';
import {getDeterministicResponse} from './deterministic-response.service';
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
vi.mock('../agent/graph',()=>({agentGraph:{invoke:vi.fn()}}));

describe('chat pipeline business AI kill switch',()=>{beforeEach(()=>{vi.clearAllMocks()});
 it('stores Business A inbound message but performs no generation or automated reply while suspended',async()=>{vi.mocked(evaluateBusinessAIAccess).mockResolvedValue({allowed:false,reason:'PLATFORM_SUSPENDED'});const usage=vi.spyOn(AIUsage,'findOneAndUpdate');const result=await processChatTurn({businessId:'business-a',conversationId:'c-a',eventIdentifier:'e-a',message:'price koto?'});expect(result).toMatchObject({status:202,body:{reply:null,aiAccess:'PLATFORM_SUSPENDED'}});expect(getDeterministicResponse).not.toHaveBeenCalled();expect(agentGraph.invoke).not.toHaveBeenCalled();expect(usage).not.toHaveBeenCalled()});
 it('allows an unaffected or resumed Business B future message',async()=>{vi.mocked(evaluateBusinessAIAccess).mockResolvedValue({allowed:true});vi.mocked(getDeterministicResponse).mockResolvedValue('Canonical reply');const result=await processChatTurn({businessId:'business-b',conversationId:'c-b',eventIdentifier:'e-b',message:'price koto?'});expect(result).toMatchObject({status:200,body:{reply:'Canonical reply',deterministic:true}});expect(evaluateBusinessAIAccess).toHaveBeenCalledWith('business-b')});
});
