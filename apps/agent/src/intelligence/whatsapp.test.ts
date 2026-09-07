import {it,expect} from 'vitest';
import crypto from 'node:crypto';
import {validMetaSignature,whatsappMessages} from './whatsapp-payload';
it('requires exact raw-body signature',()=>{const body=Buffer.from('{"a":1}');const sig='sha256='+crypto.createHmac('sha256','secret').update(body).digest('hex');expect(validMetaSignature(body,sig,'secret')).toBe(true);expect(validMetaSignature(Buffer.from('{}'),sig,'secret')).toBe(false);expect(validMetaSignature(body,sig,undefined)).toBe(false);});
it('extracts text identity and ignores status-only notifications',()=>{expect(whatsappMessages({object:'whatsapp_business_account',entry:[{changes:[{value:{metadata:{phone_number_id:'12345'},messages:[{id:'wamid.1',from:'8801712345678',type:'text',text:{body:'price?'}}]}}]}]})).toMatchObject([{from:'8801712345678',text:'price?',phoneNumberId:'12345'}]);expect(whatsappMessages({object:'page'})).toEqual([]);});
