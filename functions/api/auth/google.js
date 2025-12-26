export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const friendUid = url.searchParams.get('friend') || ""; 

    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = env.GOOGLE_REDIRECT_URI;
    const scope = "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

    // friendUid를 state에 담아 보냅니다.
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` +
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `state=${encodeURIComponent(friendUid)}`;

    return Response.redirect(googleAuthUrl);
}
