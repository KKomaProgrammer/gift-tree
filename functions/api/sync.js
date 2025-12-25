export async function onRequestPost(context) {
    const { env, request } = context;
    const { uid, totalExp } = await request.json();

    if (!uid) return new Response("Unauthorized", { status: 401 });

    try {
        await env.D1.prepare(`
            UPDATE users 
            SET total_exp = ?, last_sync_time = ? 
            WHERE uid = ?
        `).bind(totalExp, Date.now(), uid).run();

        return new Response(JSON.stringify({ success: true }), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
