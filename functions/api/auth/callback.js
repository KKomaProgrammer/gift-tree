// functions/api/auth/callback.js
export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get("code");

    if (!code) return new Response("Authorization code not found", { status: 400 });

    try {
        // 1. 구글에 code를 주고 token 요청
        const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
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
        const tokens = await tokenRes.json();

        // 2. 토큰으로 사용자 정보 가져오기
        const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const profile = await userRes.json();

        // 3. D1 DB 저장 (Upsert)
        await env.D1.prepare(`
            INSERT INTO users (uid, display_name, email, last_sync_time)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(uid) DO UPDATE SET last_sync_time = ?
        `).bind(profile.sub, profile.name, profile.email, Date.now(), Date.now()).run();

        // 4. 성공 후 메인 페이지로 이동 (UID 전달)
        return Response.redirect(`${url.origin}/?uid=${profile.sub}`);

    } catch (e) {
        return new Response(`Error: ${e.message}`, { status: 500 });
    }
}
