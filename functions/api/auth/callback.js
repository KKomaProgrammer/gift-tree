export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const code = url.searchParams.get('code');
    const friendUid = url.searchParams.get('state'); // google.js에서 보낸 값

    if (!code) return new Response("Code missing", { status: 400 });

    // 1. 토큰 교환
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        body: JSON.stringify({
            code,
            client_id: env.GOOGLE_CLIENT_ID,
            client_secret: env.GOOGLE_CLIENT_SECRET,
            redirect_uri: env.GOOGLE_REDIRECT_URI,
            grant_type: "authorization_code",
        }),
    });
    const tokens = await tokenRes.json();

    // 2. 유저 정보 가져오기
    const userRes = await fetch("https://www.googleapis.com/userinfo/v2/me", {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const user = await userRes.json();

    // 3. DB에 유저 생성/업데이트
    await env.D1.prepare(`
        INSERT INTO users (uid, display_name, email) 
        VALUES (?, ?, ?) 
        ON CONFLICT(uid) DO UPDATE SET display_name = EXCLUDED.display_name
    `).bind(user.id, user.name, user.email).run();

    // 4. 원래 페이지로 복귀 (friend 정보 유지)
    const redirectPath = friendUid ? `/?uid=${user.id}&friend=${friendUid}` : `/?uid=${user.id}`;
    return Response.redirect(`${url.origin}${redirectPath}`);
}
