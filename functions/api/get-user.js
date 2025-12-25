export async function onRequestGet(context) {
    const { env, request } = context;
    const url = new URL(request.url);
    const uid = urlParams.get('uid');

    if (!uid) return new Response("UID missing", { status: 400 });

    try {
        const user = await env.D1.prepare("SELECT * FROM users WHERE uid = ?")
            .bind(uid)
            .first();

        if (!user) {
            return new Response("User not found", { status: 404 });
        }

        return new Response(JSON.stringify(user), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
