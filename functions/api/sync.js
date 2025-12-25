// functions/api/sync.js

export async function onRequestPost(context) {
    const { env, request } = context;

    try {
        // 1. 데이터 파싱
        const { uid, contributor, gainedExp, message } = await request.json();
        
        // [보안] 필수 데이터 체크
        if (!uid || !contributor) {
            return new Response(JSON.stringify({ success: false, message: "인증 정보가 부족합니다." }), { status: 400 });
        }

        // 2. IP 및 날짜 정보 가져오기 (KST 기준)
        const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
        const now = new Date();
        const kstTime = new Date(now.getTime() + (9 * 60 * 60 * 1000)); // UTC -> KST
        const today = kstTime.toISOString().split('T')[0]; // YYYY-MM-DD 형식

        // 3. 기여자(contributor)의 오늘 활동 기록 확인
        // DB에서 해당 유저의 마지막 기여 날짜를 가져옴
        const contributorInfo = await env.D1.prepare(
            "SELECT last_contribution_date FROM users WHERE uid = ?"
        ).bind(contributor).first();

        // [보안] 하루 1회 제한 로직
        if (contributorInfo && contributorInfo.last_contribution_date === today) {
            return new Response(JSON.stringify({ 
                success: false, 
                message: "오늘의 정성은 이미 전달되었습니다. 내일 다시 참여해 주세요!" 
            }), { status: 403 });
        }

        // 4. 데이터베이스 업데이트 (트랜잭션/일괄 처리 권장)
        // A. 트리의 주인(uid) 경험치 올리기
        // B. 기여자(contributor)의 오늘 날짜 업데이트
        // C. (선택) 응원 메시지가 있다면 저장
        
        const statements = [
            // 트리의 주인 경험치 증가
            env.D1.prepare("UPDATE users SET total_exp = total_exp + ? WHERE uid = ?").bind(gainedExp, uid),
            
            // 기여자의 날짜 업데이트 (IP 정보를 기록하고 싶다면 테이블에 컬럼 추가 필요, 여기서는 날짜만 우선 업데이트)
            env.D1.prepare("UPDATE users SET last_contribution_date = ? WHERE uid = ?").bind(today, contributor)
        ];

        // 메시지가 있는 경우 (친구 응원 시)
        if (message) {
            statements.push(
                env.D1.prepare("INSERT INTO messages (receiver_id, sender_name, content, created_at) VALUES (?, ?, ?, ?)")
                .bind(uid, "친구", message, Date.now())
            );
        }

        // 모든 쿼리 실행
        await env.D1.batch(statements);

        return new Response(JSON.stringify({ 
            success: true, 
            message: "성공적으로 정성이 전달되었습니다!" 
        }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (error) {
        return new Response(JSON.stringify({ 
            success: false, 
            message: "서버 오류: " + error.message 
        }), { status: 500 });
    }
}
