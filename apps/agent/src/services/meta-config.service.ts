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
    const appSecret = clean(process.env.FB_APP_SECRET);
    const verifyToken = clean(process.env.FB_VERIFY_TOKEN);
    const graphVersion = clean(process.env.FB_GRAPH_API_VERSION) || DEFAULT_GRAPH_VERSION;
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
