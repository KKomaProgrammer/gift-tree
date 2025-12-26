export async function onRequestGet(context) {
    const { env, request } = context;
    const { searchParams } = new URL(request.url);
    const uid = searchParams.get('uid');
    const viewer = searchParams.get('viewer');

    if (!uid) return new Response("UID missing", { status: 400 });

    const targetUser = await env.D1.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
    let viewerData = null;
    if (viewer) {
        viewerData = await env.D1.prepare("SELECT last_contribution_date FROM users WHERE uid = ?").bind(viewer).first();
    }

    return new Response(JSON.stringify({
        ...targetUser,
        viewer_last_contribution: viewerData ? viewerData.last_contribution_date : null
    }), { headers: { "Content-Type": "application/json" } });
}
