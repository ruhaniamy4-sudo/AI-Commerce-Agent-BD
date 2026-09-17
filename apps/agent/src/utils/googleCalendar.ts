// googleapis is by far the heaviest dependency in this tree — roughly 0.75s to
// require, more than a quarter of the agent's boot — and every route that needs
// it sits behind the Google connect flow. Requiring it on first use instead of
// at import keeps that cost out of each dev-server restart and each cold start.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const loadGoogle = (): typeof import('googleapis').google => require('googleapis').google;

type OAuth2Client = InstanceType<typeof import('googleapis').google.auth.OAuth2>;

let client: OAuth2Client | undefined;

/**
 * The process-wide OAuth client. It has to stay a singleton: `/google/callback`
 * calls `setCredentials` on it and later routes read `credentials` back off the
 * same object, so handing out a fresh client per call would lose the tokens.
 */
export function getOAuthClient(): OAuth2Client {
    if (!client) {
        client = new (loadGoogle().auth.OAuth2)(
            process.env.GOOGLE_CLIENT_ID,
            process.env.GOOGLE_CLIENT_SECRET,
            process.env.GOOGLE_REDIRECT_URI,
        );
    }
    return client;
}

/** A Calendar v3 client bound to the OAuth credentials collected above. */
export function getCalendar() {
    return loadGoogle().calendar({ version: 'v3', auth: getOAuthClient() });
}
