export async function onRequestPost(context) {
    const { env, request } = context;
    const { friendUid, message, senderName } = await request.json();

    const BOOST_DURATION = 10 * 60 * 1000; // 10분 (밀리초)
    const expiry = Date.now() + BOOST_DURATION;

    try {
        // 1. 친구의 부스트 종료 시간 업데이트
        await env.D1.prepare("UPDATE users SET multiplier_expiry = ? WHERE uid = ?")
            .bind(expiry, friendUid).run();

        // 2. 응원 메시지 기록
        await env.D1.prepare("INSERT INTO messages (receiver_id, sender_name, content, created_at) VALUES (?, ?, ?, ?)")
            .bind(friendUid, senderName, message, Date.now()).run();

        return new Response(JSON.stringify({ success: true }));
    } catch (e) {
        return new Response(e.message, { status: 500 });
    }
}
