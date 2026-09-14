import mongoose from 'mongoose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BusinessChannel } from '../models/BusinessChannel';
import { WhatsAppSignupSession } from '../models/WhatsAppSignupSession';
import { MetaGraphError, metaGraph } from './meta-graph.service';
import { completeWhatsAppEmbeddedSignup, whatsappSetupOptions } from './whatsapp-connection.service';

vi.mock('./meta-credentials.service', () => ({
    encryptMetaAccessToken: (token: string) => `enc:${token}`,
    decryptMetaAccessToken: (token: string) => token.replace('enc:', ''),
    redactMetaSecrets: (value: unknown) => String(value),
}));

const businessId = new mongoose.Types.ObjectId().toString();
const otherBusinessId = new mongoose.Types.ObjectId().toString();
const userId = new mongoose.Types.ObjectId().toString();
const CODE = 'signup-code-from-meta';

function number(id: string, display: string) {
    return { id, display_phone_number: display, verified_name: 'Rafi Store', quality_rating: 'GREEN', platform_type: 'CLOUD_API' };
}

/** Everything Meta would answer for a healthy one-number account. */
function mockHappyGraph(numbers = [number('55501', '+880 1712 345678')]) {
    vi.spyOn(metaGraph, 'exchangeEmbeddedSignupCode').mockResolvedValue({ access_token: 'business-token' });
    vi.spyOn(metaGraph, 'whatsappAccount').mockResolvedValue({ id: '900900', name: 'Rafi Store' });
    vi.spyOn(metaGraph, 'whatsappNumbers').mockResolvedValue({ data: numbers });
    vi.spyOn(metaGraph, 'subscribeWhatsApp').mockResolvedValue({ success: true });
    vi.spyOn(metaGraph, 'registerWhatsAppNumber').mockResolvedValue({ success: true });
}

function captureSavedChannel() {
    return vi.spyOn(BusinessChannel, 'findOneAndUpdate').mockImplementation(((_filter: any, update: any) => ({
        lean: () => Promise.resolve({ _id: 'channel-1', externalId: '55501', ...update.$set }),
    })) as never);
}

describe('WhatsApp guided setup', () => {
    beforeEach(() => {
        vi.restoreAllMocks();
        process.env.FB_APP_ID = 'app-id';
        process.env.FB_APP_SECRET = 'app-secret';
        process.env.WHATSAPP_CONFIG_ID = '1234567890';
        vi.spyOn(BusinessChannel, 'findOne').mockReturnValue({ lean: () => Promise.resolve(null) } as never);
    });
    afterEach(() => {
        delete process.env.FB_APP_ID;
        delete process.env.FB_APP_SECRET;
        delete process.env.WHATSAPP_CONFIG_ID;
    });

    it('offers guided setup only when the deployment can finish it', () => {
        expect(whatsappSetupOptions()).toMatchObject({ guidedAvailable: true, appId: 'app-id', configId: '1234567890' });
        delete process.env.WHATSAPP_CONFIG_ID;
        expect(whatsappSetupOptions()).toMatchObject({ guidedAvailable: false, configId: null });
    });

    it('never leaks the app secret to the dashboard', () => {
        expect(JSON.stringify(whatsappSetupOptions())).not.toContain('app-secret');
    });

    it('turns one signup code into a connected number without asking anything else', async () => {
        mockHappyGraph();
        const save = captureSavedChannel();

        const result = await completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900', phoneNumberId: '55501' });

        expect(metaGraph.subscribeWhatsApp).toHaveBeenCalledWith('900900', 'business-token');
        expect(metaGraph.registerWhatsAppNumber).toHaveBeenCalledWith('55501', 'business-token', expect.stringMatching(/^\d{6}$/));
        expect(result).toMatchObject({
            connection: {
                phoneNumberId: '55501',
                wabaId: '900900',
                displayPhoneNumber: '+880 1712 345678',
                connectionStatus: 'CONNECTED',
                aiEnabled: true,
                setupMode: 'guided',
            },
        });
        // The token is stored encrypted and never travels back to the browser.
        expect(save.mock.calls[0][1]).toMatchObject({ $set: expect.objectContaining({ encryptedAccessToken: 'enc:business-token' }) });
        expect(JSON.stringify(result)).not.toContain('business-token');
    });

    it('finds the account from the token when the browser did not report one', async () => {
        mockHappyGraph();
        vi.spyOn(metaGraph, 'debugToken').mockResolvedValue({
            data: { granular_scopes: [{ scope: 'whatsapp_business_management', target_ids: ['900900'] }] },
        });
        captureSavedChannel();

        await completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE });

        expect(metaGraph.debugToken).toHaveBeenCalledWith('business-token', 'app-id', 'app-secret');
        expect(metaGraph.whatsappNumbers).toHaveBeenCalledWith('900900', 'business-token');
    });

    it('asks which number to use only when the account really holds several', async () => {
        mockHappyGraph([number('55501', '+880 1712 345678'), number('55502', '+880 1811 111111')]);
        vi.spyOn(WhatsAppSignupSession, 'create').mockImplementation((async (document: any) => ({
            _id: 'session-1', numbers: document.numbers, save: vi.fn(),
        })) as never);
        const save = captureSavedChannel();

        const result = await completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900' });

        expect(save).not.toHaveBeenCalled();
        expect(result).toMatchObject({ sessionId: 'session-1', wabaName: 'Rafi Store' });
        expect((result as any).numbers).toHaveLength(2);
        // The parked token is encrypted, and the choice ids carry no account data.
        const [parked] = (WhatsAppSignupSession.create as any).mock.calls[0];
        expect(parked.encryptedAccessToken).toBe('enc:business-token');
        expect(JSON.stringify((result as any).numbers)).not.toContain('business-token');
    });

    it('keeps a number that cannot send yet out of service instead of failing silently', async () => {
        mockHappyGraph();
        vi.spyOn(metaGraph, 'registerWhatsAppNumber').mockRejectedValue(new MetaGraphError('INVALID_REQUEST', '133005', 400, 'PIN mismatch'));
        captureSavedChannel();

        const result: any = await completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900', phoneNumberId: '55501' });

        expect(result.connection).toMatchObject({
            connectionStatus: 'NEEDS_ATTENTION',
            aiEnabled: false,
            lastErrorCode: 'REGISTRATION_133005',
        });
    });

    it('records a webhook subscription Meta did not confirm', async () => {
        mockHappyGraph();
        vi.spyOn(metaGraph, 'subscribeWhatsApp').mockResolvedValue({ success: false });
        captureSavedChannel();

        const result: any = await completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900', phoneNumberId: '55501' });

        expect(result.connection).toMatchObject({ connectionStatus: 'NEEDS_ATTENTION', lastErrorCode: 'SUBSCRIPTION_MISSING' });
        expect(result.connection.subscription).toMatchObject({ subscribed: false });
    });

    it('leaves a number that already belongs to another business alone', async () => {
        mockHappyGraph();
        vi.spyOn(BusinessChannel, 'findOne').mockReturnValue({
            lean: () => Promise.resolve({ _id: 'other', businessId: otherBusinessId }),
        } as never);
        const save = captureSavedChannel();

        await expect(completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900', phoneNumberId: '55501' }))
            .rejects.toThrow(/already connected to another business/i);
        expect(save).not.toHaveBeenCalled();
    });

    it('does not register a number the merchant still uses in the WhatsApp Business app', async () => {
        mockHappyGraph();
        captureSavedChannel();

        const result: any = await completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900', phoneNumberId: '55501', coexistence: true });

        expect(metaGraph.registerWhatsAppNumber).not.toHaveBeenCalled();
        expect(result.connection).toMatchObject({ connectionStatus: 'CONNECTED', platformType: 'COEXISTENCE' });
    });

    it('refuses a deployment that has no Embedded Signup configuration', async () => {
        delete process.env.WHATSAPP_CONFIG_ID;
        await expect(completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE }))
            .rejects.toThrow(/guided setup is not configured/i);
    });

    it('says so plainly when the account has no phone number yet', async () => {
        mockHappyGraph([]);
        await expect(completeWhatsAppEmbeddedSignup(businessId, userId, { code: CODE, wabaId: '900900' }))
            .rejects.toThrow(/no phone number yet/i);
    });
});
