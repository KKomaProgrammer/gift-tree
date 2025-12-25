export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) return new Response("Code not found", { status: 400 });

    try {
        // 1. Google에 'code'를 주고 'access_token' 요청
        const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                code,
                client_id: env.GOOGLE_CLIENT_ID,
                client_secret: env.GOOGLE_CLIENT_SECRET,
                redirect_uri: env.GOOGLE_REDIRECT_URI,
                grant_type: "authorization_code",
            }),
        });
        const tokens = await tokenResponse.json();

        // 2. 받은 토큰으로 사용자 프로필 가져오기
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await userRes.json(); // sub(ID), name, email 포함

        // 3. D1 DB에 사용자 정보 저장 (이미 있으면 무시, 없으면 생성)
        // last_sync_time을 현재 시간으로 설정
        await env.D1.prepare(`
            INSERT INTO users (uid, display_name, email, last_sync_time)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET
            display_name = excluded.display_name
        `).bind(profile.sub, profile.name, profile.email, Date.now()).run();

        // 4. 메인 페이지로 리다이렉트 (쿠키나 URL 파라미터로 UID 전달)
        // 실제로는 보안을 위해 JWT 세션을 사용해야 하지만, 여기서는 간단히 UID를 전달합니다.
        return Response.redirect(`${url.origin}/?uid=${profile.sub}&name=${encodeURIComponent(profile.name)}`);

    } catch (error) {
        return new Response("Auth Error: " + error.message, { status: 500 });
    }
}
