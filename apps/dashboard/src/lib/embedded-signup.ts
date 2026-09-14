/**
 * Meta's Embedded Signup, wrapped so the Integrations page only has to await one
 * promise. The merchant sees Meta's own dialog: they pick or create a WhatsApp
 * Business Account, verify the number there, and the browser comes back with a
 * one-time code. No token, no phone number id, and nothing to copy by hand.
 *
 * Only the code leaves this module. Everything it unlocks is done server-side.
 */

type SignupEvent = {
    type?: string;
    event?: string;
    data?: { phone_number_id?: string; waba_id?: string; current_step?: string; error_message?: string };
};

export interface SignupOptions {
    appId: string;
    configId: string;
    graphVersion: string;
    /** The number already lives in the merchant's WhatsApp Business app. */
    coexistence?: boolean;
}

export interface SignupOutcome {
    code: string;
    wabaId?: string;
    phoneNumberId?: string;
    coexistence: boolean;
}

export class SignupCancelled extends Error {
    constructor(public step?: string) {
        super('WhatsApp setup was closed before it finished');
        this.name = 'SignupCancelled';
    }
}

/** The only part of a login response this flow reads: the one-time code. */
interface FacebookLoginResponse {
    status?: string;
    authResponse?: { code?: string } | null;
}

declare global {
    interface Window {
        FB?: {
            init: (options: Record<string, unknown>) => void;
            login: (callback: (response: FacebookLoginResponse) => void, options: Record<string, unknown>) => void;
        };
        fbAsyncInit?: () => void;
    }
}

const SDK_ID = 'facebook-jssdk';
let sdkPromise: Promise<void> | null = null;

/** The SDK is loaded once per tab, and only when a merchant actually starts setup. */
function loadFacebookSdk(appId: string, graphVersion: string) {
    if (typeof window === 'undefined') return Promise.reject(new Error('WhatsApp setup needs a browser'));
    if (window.FB) return Promise.resolve();
    if (sdkPromise) return sdkPromise;

    sdkPromise = new Promise<void>((resolve, reject) => {
        const existing = document.getElementById(SDK_ID);
        const initialize = () => {
            window.FB?.init({ appId, autoLogAppEvents: true, xfbml: false, version: graphVersion });
            resolve();
        };
        if (existing) {
            if (window.FB) return initialize();
            existing.addEventListener('load', initialize, { once: true });
            existing.addEventListener('error', () => reject(new Error('Facebook could not be reached')), { once: true });
            return;
        }
        const script = document.createElement('script');
        script.id = SDK_ID;
        script.src = 'https://connect.facebook.net/en_US/sdk.js';
        script.async = true;
        script.defer = true;
        script.crossOrigin = 'anonymous';
        script.onload = initialize;
        script.onerror = () => {
            sdkPromise = null;
            reject(new Error('Facebook could not be reached. Check your connection or any content blocker, then try again.'));
        };
        document.body.appendChild(script);
    });
    return sdkPromise;
}

/** Only Facebook itself may report the account and number that were just set up. */
function fromFacebook(origin: string) {
    try {
        const { hostname, protocol } = new URL(origin);
        return protocol === 'https:' && (hostname === 'facebook.com' || hostname.endsWith('.facebook.com'));
    } catch {
        return false;
    }
}

export async function launchWhatsAppSignup(options: SignupOptions): Promise<SignupOutcome> {
    await loadFacebookSdk(options.appId, options.graphVersion);
    const coexistence = options.coexistence === true;

    // The signup dialog reports the account it created over postMessage, while the
    // code arrives through the login callback. Either can land first, so the
    // account details are captured as they come and read once the code is in.
    let session: { wabaId?: string; phoneNumberId?: string } = {};
    let cancelledAt: string | undefined;
    let reportedError: string | undefined;

    const onMessage = (event: MessageEvent) => {
        if (!fromFacebook(event.origin) || typeof event.data !== 'string') return;
        let payload: SignupEvent;
        try { payload = JSON.parse(event.data); } catch { return; }
        if (payload.type !== 'WA_EMBEDDED_SIGNUP') return;
        if (payload.event?.startsWith('FINISH')) {
            session = { wabaId: payload.data?.waba_id, phoneNumberId: payload.data?.phone_number_id };
        } else if (payload.event === 'CANCEL') {
            cancelledAt = payload.data?.current_step;
        } else if (payload.event === 'ERROR') {
            reportedError = payload.data?.error_message;
        }
    };
    window.addEventListener('message', onMessage);

    try {
        return await new Promise<SignupOutcome>((resolve, reject) => {
            window.FB!.login(
                (response) => {
                    const code = response?.authResponse?.code;
                    if (code) return resolve({ code, ...session, coexistence });
                    if (reportedError) return reject(new Error(reportedError));
                    reject(new SignupCancelled(cancelledAt));
                },
                {
                    config_id: options.configId,
                    response_type: 'code',
                    override_default_response_type: true,
                    extras: {
                        setup: {},
                        sessionInfoVersion: '3',
                        ...(coexistence ? { featureType: 'whatsapp_business_app_onboarding' } : { featureType: '' }),
                    },
                },
            );
        });
    } finally {
        window.removeEventListener('message', onMessage);
    }
}
