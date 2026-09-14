const DEFAULT_GRAPH_VERSION = 'v26.0';

function clean(value: string | undefined) {
    return String(value || '').trim();
}

export const META_CORE_PERMISSIONS = [
    'pages_show_list',
    'pages_messaging',
    'pages_manage_metadata',
] as const;

export const META_OPTIONAL_CONTENT_PERMISSIONS = ['pages_read_engagement'] as const;
export const META_MESSAGING_WEBHOOK_FIELDS = ['messages', 'messaging_postbacks'] as const;

export function getMetaConfig() {
    const appId = clean(process.env.FB_APP_ID || process.env.FACEBOOK_APP_ID);
    const appSecret = clean(process.env.FB_APP_SECRET || process.env.FACEBOOK_APP_SECRET);
    const verifyToken = clean(process.env.FB_VERIFY_TOKEN || process.env.FACEBOOK_VERIFY_TOKEN);
    // Two env names for one value exist in the wild here; accept either so a
    // deployment cannot end up calling two different Graph versions at once.
    const graphVersion = clean(process.env.FB_GRAPH_API_VERSION) || clean(process.env.META_GRAPH_API_VERSION) || DEFAULT_GRAPH_VERSION;
    const publicAgentUrl = clean(process.env.PUBLIC_AGENT_URL).replace(/\/$/, '');
    const dashboardUrl = clean(process.env.DASHBOARD_URL).replace(/\/$/, '');
    const redirectUri = clean(process.env.FB_OAUTH_REDIRECT_URI) || (publicAgentUrl ? `${publicAgentUrl}/facebook/oauth/callback` : '');
    const configId = clean(process.env.FB_CONFIG_ID || process.env.FACEBOOK_CONFIG_ID);
    return { appId, appSecret, verifyToken, graphVersion, publicAgentUrl, dashboardUrl, redirectUri, configId };
}

export function assertMetaOAuthConfigured() {
    const config = getMetaConfig();
    if (!config.appId || !config.appSecret || !config.redirectUri || !config.dashboardUrl) {
        throw new Error('Meta OAuth is not configured');
    }
    return config;
}

export function assertMetaWebhookConfigured() {
    const config = getMetaConfig();
    if (!config.appSecret || !config.verifyToken) throw new Error('Meta webhook verification is not configured');
    return config;
}

export const WHATSAPP_WEBHOOK_FIELDS = ['messages'] as const;

/**
 * WhatsApp shares the Meta app with Messenger. Operators who already set the
 * Facebook values should not have to set them twice, so every field falls back
 * to its Messenger equivalent and only the Embedded Signup configuration is
 * genuinely WhatsApp-only.
 */
export function getWhatsAppConfig() {
    const meta = getMetaConfig();
    return {
        appId: clean(process.env.WHATSAPP_APP_ID) || meta.appId,
        appSecret: clean(process.env.WHATSAPP_APP_SECRET) || meta.appSecret,
        verifyToken: clean(process.env.WHATSAPP_VERIFY_TOKEN) || meta.verifyToken,
        configId: clean(process.env.WHATSAPP_CONFIG_ID),
        graphVersion: meta.graphVersion,
        publicAgentUrl: meta.publicAgentUrl,
        dashboardUrl: meta.dashboardUrl,
    };
}

/** Guided setup needs the app credentials plus the Embedded Signup configuration. */
export function assertWhatsAppSignupConfigured() {
    const config = getWhatsAppConfig();
    if (!config.appId || !config.appSecret || !config.configId) {
        throw new Error('WhatsApp guided setup is not configured on this deployment');
    }
    return config;
}

export function assertWhatsAppWebhookConfigured() {
    const config = getWhatsAppConfig();
    if (!config.appSecret || !config.verifyToken) throw new Error('WhatsApp webhook verification is not configured');
    return config;
}
