export async function onRequestGet(context) {
  const { env, request } = context;
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

  // 1. Token Exchange (Authorization Code -> Access Token)
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: JSON.stringify({
      code,
      client_id: env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      redirect_uri: env.REDIRECT_URI,
      grant_type: "authorization_code",
    }),
  });
  const tokens = await tokenResponse.json();

  // 2. User Info 획득
  const userRes = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  const profile = await userRes.json();

  // 3. D1에 사용자 확인 및 생성 (Upsert)
  await env.D1.prepare(`
    INSERT INTO users (uid, display_name, email, last_sync_time)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(uid) DO NOTHING
  `).bind(profile.sub, profile.name, profile.email, Date.now()).run();

  // 세션 처리(JWT 등) 후 클라이언트로 리다이렉트
  return Response.redirect(`${url.origin}/?login=success&uid=${profile.sub}`);
}
