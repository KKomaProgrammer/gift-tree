export async function onRequestPost(context) {
    const { env, request } = context;
    const { uid, contributor, totalExp, gainedExp, isDaily } = await request.json();

    const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });

    // 1. 트리 주인(관리자)의 실시간 가속 저장
    if (!isDaily && uid === contributor) {
        await env.D1.prepare("UPDATE users SET total_exp = ? WHERE uid = ?")
            .bind(totalExp, uid).run();
        return new Response(JSON.stringify({ success: true }));
    }

    // 2. 하루 1회 기여 제한 (본인 트리 기여 혹은 친구 응원)
    if (isDaily) {
        const user = await env.D1.prepare("SELECT last_contribution_date FROM users WHERE uid = ?")
            .bind(contributor).first();

        if (user && user.last_contribution_date === today) {
            return new Response(JSON.stringify({ success: false, message: "오늘은 이미 정성을 쏟으셨습니다!" }), { status: 403 });
        }

        await env.D1.batch([
            env.D1.prepare("UPDATE users SET total_exp = total_exp + ? WHERE uid = ?").bind(gainedExp, uid),
            env.D1.prepare("UPDATE users SET last_contribution_date = ? WHERE uid = ?").bind(today, contributor)
        ]);
        return new Response(JSON.stringify({ success: true }));
    }

    return new Response("Unauthorized", { status: 403 });
}
