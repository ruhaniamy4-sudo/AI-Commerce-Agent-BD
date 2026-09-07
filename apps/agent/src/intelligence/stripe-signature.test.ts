import {it,expect} from 'vitest';
import crypto from 'node:crypto';
import {validStripeSignature} from './stripe-signature';
it('validates raw Stripe payloads and rejects stale or changed requests',()=>{const raw=Buffer.from('{"id":"evt1"}');const now=Date.now();const timestamp=String(Math.floor(now/1000));const signature=crypto.createHmac('sha256','secret').update(timestamp+'.').update(raw).digest('hex');const header=`t=${timestamp},v1=${signature}`;expect(validStripeSignature(raw,header,'secret',now)).toBe(true);expect(validStripeSignature(Buffer.from('{}'),header,'secret',now)).toBe(false);expect(validStripeSignature(raw,header,'secret',now+301000)).toBe(false);});
