let currentExp = 0;
let level = 1;

function animateGrowth() {
  const nextLevelXP = 100 * Math.pow(1.5, level - 1);
  const progressPercent = (currentExp / nextLevelXP) * 100;
  
  // 트리 크기 계산: 기본 크기 + (진행도에 따른 스케일)
  const scale = 1 + (level * 0.2) + (progressPercent / 500);
  document.getElementById('tree').style.transform = `scale(${scale})`;
  
  // 프로그레스 바 업데이트
  document.getElementById('progress-bar').style.width = `${progressPercent}%`;
  
  requestAnimationFrame(animateGrowth);
}
