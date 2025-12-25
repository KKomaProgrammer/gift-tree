// functions/api/sync.js
export async function onRequestPost(context) {
    const { env, request } = context;
    
    try {
        const { uid, gainedExp } = await request.json();
        
        // 1. 로그인 여부 확인
        if (!uid) return new Response(JSON.stringify({ error: "로그인이 필요합니다." }), { status: 401 });

        // 2. 오늘 날짜 구하기 (KST 기준 YYYY-MM-DD)
        const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

        // 3. 유저 데이터 조회
        const user = await env.D1.prepare("SELECT last_contribution_date, total_exp FROM users WHERE uid = ?")
            .bind(uid).first();

        // 4. 하루 한 번 제한 확인
        if (user && user.last_contribution_date === today) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "오늘은 이미 기여하셨습니다. 내일 다시 와주세요!" 
            }), { status: 403 });
        }

        // 5. 경험치 업데이트 및 날짜 저장
        await env.D1.prepare(`
            UPDATE users 
            SET total_exp = total_exp + ?, last_contribution_date = ? 
            WHERE uid = ?
        `).bind(gainedExp, today, uid).run();

        return new Response(JSON.stringify({ success: true, message: "트리가 성장했습니다!" }));

    } catch (e) {
        return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
}
