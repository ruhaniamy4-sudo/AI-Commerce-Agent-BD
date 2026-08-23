// Node 18+ (has global fetch). For older Node, install node-fetch.

export async function exchangeForLongLivedUserToken({
    appId,
    appSecret,
    shortLivedUserToken,
    graphVersion = 'v22.0',
}) {
    const url = new URL(
        `https://graph.facebook.com/${graphVersion}/oauth/access_token`
    );
    url.searchParams.set('grant_type', 'fb_exchange_token');
    url.searchParams.set('client_id', appId);
    url.searchParams.set('client_secret', appSecret);
    url.searchParams.set('fb_exchange_token', shortLivedUserToken);

    const res = await fetch(url.toString(), { method: 'GET' });
    const data = await res.json();

    if (!res.ok) {
        throw new Error(`Token exchange failed: ${JSON.stringify(data)}`);
    }

    // data: { access_token, token_type, expires_in }
    return {
        longLivedUserToken: data.access_token,
        expiresIn: data.expires_in,
        tokenType: data.token_type,
    };
}
const token =
    'EAAMooT9PR5UBQdamdaG6GumMSdGxaIWmpFM703MoIa7oExEopEAYfZB3RQkdp9PmdqRc9dcv7xUzFd8uORYbN4RS13y5ci5UPVifUEPe4KdnnJhPb5IML8NdXq05gj7tLB9Sr6KVfZCUDIqyY88vzYzkstC8jSTmESEGLYs3nG9qJih3QqUQeITSBMuwJTCEwkSIeVIz61oXB69RdVgpnEFYQ8B0InjY7Ua6yrqcuRCMrqwpE0sgZDZD';
const appId = '889097947137941';
const appSecret = 'd47714972a46d85f045d7980e3d14ec6';
exchangeForLongLivedUserToken({
    appId,
    appSecret,
    shortLivedUserToken: token,
}).then((res) => {
    console.log(res);
});
