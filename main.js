// --- 설정값 ---
const BASE_XP_PER_TICK = 0.05; // 자동 성장 속도 (초당 약 0.5 XP)
const PRESS_XP_MULTIPLIER = 10; // 길게 누를 때 배율
const LEVEL_UP_BASE = 100;     // 레벨 1 -> 2에 필요한 XP
const LEVEL_UP_FACTOR = 1.5;   // 단계별 난이도 상승 계수

// --- 상태 관리 ---
let state = {
    uid: null,
    displayName: '',
    totalExp: 0,
    currentLevel: 1,
    isBoosted: false,
    lastUpdate: Date.now(),
    isPressing: false,
    viewingFriend: null // 친구 페이지 여부
};

// --- 초기화 ---
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    state.viewingFriend = urlParams.get('friend');

    // 1. 로그인 여부 확인 (서버 세션 혹은 로컬스토리지)
    checkAuth();
    
    // 2. 친구 모드일 경우 UI 변경
    if (state.viewingFriend) {
        initFriendView(state.viewingFriend);
    }

    // 3. 메인 성장 루프 시작 (매 초 실행)
    setInterval(autoGrow, 1000);
    
    // 4. 길게 누르기 이벤트 리스너
    setupPressEvents();
};

/**
 * 레벨 계산기: 현재 누적 XP로 레벨과 다음 단계까지의 진행도 계산
 * 누적 XP가 아닌 현재 레벨에서의 잔여 XP 방식
 */
function calculateLevel(totalExp) {
    let level = 1;
    let tempExp = totalExp;
    let required = LEVEL_UP_BASE;

    while (tempExp >= required) {
        tempExp -= required;
        level++;
        required *= LEVEL_UP_FACTOR; // 갈수록 많이 필요함
    }

    return { level, currentExp: tempExp, required };
}

/**
 * UI 업데이트: 트리 크기 및 텍스트 변경
 */
function updateUI() {
    const { level, currentExp, required } = calculateLevel(state.totalExp);
    const progress = (currentExp / required) * 100;

    // 트리 텍스트 및 크기 조절
    const treeEmoji = level < 3 ? '🌱' : (level < 7 ? '🌿' : (level < 15 ? '🌲' : '🎄'));
    const treeContainer = document.getElementById('tree-container');
    treeContainer.innerText = treeEmoji;
    
    // 성장 시각화 (기본 크기 1 + 레벨당 0.1씩 증가 + 진행도 비례)
    const scale = 1 + (level * 0.05) + (currentExp / required * 0.2);
    treeContainer.style.transform = `scale(${scale})`;

    // 텍스트 업데이트
    document.getElementById('level-display').innerText = `Lv.${level} ${getTreeName(level)}`;
    document.getElementById('exp-display').innerText = `${Math.floor(currentExp)} / ${Math.floor(required)} XP`;
    document.getElementById('progress-bar').style.width = `${progress}%`;

    // 부스트 뱃지
    document.getElementById('boost-badge').classList.toggle('hidden', !state.isBoosted);
}

function getTreeName(level) {
    if (level < 3) return "어린 새싹";
    if (level < 7) return "쑥쑥 자라는 나무";
    if (level < 15) return "늠름한 소나무";
    return "영롱한 크리스마스 트리";
}

/**
 * 성장 로직
 */
function autoGrow() {
    if (state.viewingFriend) return; // 친구 트리는 구경만 함

    let gain = BASE_XP_PER_TICK;
    if (state.isBoosted) gain *= 2;
    if (state.isPressing) gain *= PRESS_XP_MULTIPLIER;

    state.totalExp += gain;
    updateUI();

    // 10단위로 서버에 저장 (네트워크 절약)
    if (Math.floor(state.totalExp) % 10 === 0) {
        syncData();
    }
}

/**
 * 이벤트 처리: 길게 누르기
 */
function setupPressEvents() {
    const btn = document.getElementById('grow-btn');
    
    const startPress = () => { state.isPressing = true; };
    const endPress = () => { 
        state.isPressing = false; 
        syncData(); // 손 뗄 때 즉시 저장
    };

    btn.addEventListener('mousedown', startPress);
    btn.addEventListener('mouseup', endPress);
    btn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); });
    btn.addEventListener('touchend', endPress);
}

/**
 * API 통신 (Cloudflare Functions 연결)
 */
async function syncData() {
    if (!state.uid) return;
    
    await fetch('/api/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            uid: state.uid,
            totalExp: state.totalExp
        })
    });
}

function checkAuth() {
    // 실제 구현 시 서버에서 세션을 확인하거나 Google 로그인 후 처리
    // 예시: 버튼 클릭 시 구글 로그인 페이지로 이동
    document.getElementById('google-login-btn').onclick = () => {
        location.href = '/api/auth/google'; 
    };
}

// 친구 초대 링크 생성 및 클립보드 복사
document.getElementById('share-btn').onclick = () => {
    const url = `${window.location.origin}?friend=${state.uid}`;
    navigator.clipboard.writeText(url);
    alert('친구 초대 링크가 복사되었습니다!');
};
