export async function onRequestPost(context) {
  const { env, request } = context;
  const { uid, gainedExp } = await request.json(); // 클라이언트에서 계산한 추가 경험치

  // 1. 기존 데이터 호출
  const user = await env.D1.prepare("SELECT * FROM users WHERE uid = ?").bind(uid).first();
  
  let newTotalExp = user.total_exp + gainedExp;
  let newLevel = user.current_level;

  // 2. 레벨업 체크 (Loop를 통해 여러 레벨을 한 번에 올릴 수도 있음)
  while (true) {
    const nextLevelThreshold = 100 * Math.pow(1.5, newLevel - 1);
    if (newTotalExp >= nextLevelThreshold) {
      newTotalExp -= nextLevelThreshold;
      newLevel++;
    } else {
      break;
    }
  }

  // 3. DB 업데이트
  await env.D1.prepare(
    "UPDATE users SET total_exp = ?, current_level = ?, last_sync_time = ? WHERE uid = ?"
  ).bind(newTotalExp, newLevel, Date.now(), uid).run();

  return new Response(JSON.stringify({ newLevel, newTotalExp }));
}
