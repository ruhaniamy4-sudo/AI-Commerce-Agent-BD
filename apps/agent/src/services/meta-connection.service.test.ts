import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createMetaState, verifyMetaState } from './meta-connection.service';

describe('Meta OAuth state protection', () => {
    beforeEach(() => {
        process.env.FB_APP_ID = 'app-id'; process.env.FB_APP_SECRET = 'test-app-secret';
        process.env.FB_OAUTH_REDIRECT_URI = 'https://agent.example/facebook/oauth/callback'; process.env.DASHBOARD_URL = 'https://dashboard.example';
    });
    afterEach(() => {
        delete process.env.FB_APP_ID; delete process.env.FB_APP_SECRET; delete process.env.FB_OAUTH_REDIRECT_URI; delete process.env.DASHBOARD_URL;
    });
    it('round-trips a signed, unexpired state', () => {
        const state = createMetaState('session-id', 'nonce', new Date(Date.now() + 60_000));
        expect(verifyMetaState(state)).toMatchObject({ sid: 'session-id', nonce: 'nonce' });
    });
    it('rejects tampering and expiry', () => {
        const state = createMetaState('session-id', 'nonce', new Date(Date.now() + 60_000));
        expect(() => verifyMetaState(`${state.slice(0, -1)}x`)).toThrow('Invalid Meta authorization state');
        expect(() => verifyMetaState(createMetaState('session-id', 'nonce', new Date(Date.now() - 1)))).toThrow('expired');
    });
});
