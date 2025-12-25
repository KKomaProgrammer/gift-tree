// functions/api/get-user.js
export async function onRequestGet(context) {
    const { env, request } = context;
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');

    if (!uid) return new Response("UID 필요", { status: 400 });

    const user = await env.D1.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();

    // 유저가 DB에 없으면 새로 만들어주거나 기본값 반환
    if (!user) {
        return new Response(JSON.stringify({ total_exp: 0, display_name: "새싹" }), {
            headers: { "Content-Type": "application/json" }
        });
    }

    return new Response(JSON.stringify(user), {
        headers: { "Content-Type": "application/json" }
    });
}
