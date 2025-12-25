export async function onRequestPost(context) {
    const { env, request } = context;
    
    try {
        // 클라이언트로부터 데이터 받기
        const { uid, totalExp } = await request.json();

        if (!uid || totalExp === undefined) {
            return new Response(JSON.stringify({ error: "잘못된 요청입니다." }), { status: 400 });
        }

        // [보안 Tip] 실제 운영 환경에서는 세션 쿠키를 확인하여 
        // 요청한 uid가 현재 로그인한 사람과 일치하는지 검증해야 합니다.

        // DB 업데이트: 누적 경험치와 마지막 동기화 시간 기록
        const result = await env.D1.prepare(`
            UPDATE users 
            SET total_exp = ?, last_sync_time = ? 
            WHERE uid = ?
        `)
        .bind(totalExp, Date.now(), uid)
        .run();

        if (result.success) {
            return new Response(JSON.stringify({ success: true }), {
                headers: { "Content-Type": "application/json" }
            });
        } else {
            throw new Error("DB 업데이트 실패");
        }

    } catch (error) {
        return new Response(JSON.stringify({ error: error.message }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
