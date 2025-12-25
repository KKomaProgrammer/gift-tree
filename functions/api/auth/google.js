// functions/api/auth/google.js
export async function onRequestGet(context) {
    const { env } = context;

    const clientId = env.GOOGLE_CLIENT_ID;
    const redirectUri = env.GOOGLE_REDIRECT_URI; // 환경 변수에 등록한 값
    const scope = "https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email";

    // 구글 인증 페이지 URL 생성
    const googleAuthUrl = `https://accounts.google.com/o/oauth2/v2/auth?` + 
        `client_id=${clientId}&` +
        `redirect_uri=${encodeURIComponent(redirectUri)}&` +
        `response_type=code&` +
        `scope=${encodeURIComponent(scope)}&` +
        `access_type=offline&` +
        `prompt=consent`;

    return Response.redirect(googleAuthUrl);
}
