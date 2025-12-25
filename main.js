/**
 * 크리스마스 트리 성장 프로젝트 - 전체 클라이언트 로직
 */

// --- 1. 환경 설정 및 상수 ---
const CONFIG = {
    BASE_XP_PER_SECOND: 0.1,    // 기본 자동 성장 (초당 0.1 XP)
    PRESS_XP_PER_TICK: 0.5,    // 길게 누를 때 성장 (0.1초당 0.5 XP)
    LEVEL_UP_BASE: 100,        // 레벨 1 -> 2 필요 XP
    LEVEL_UP_FACTOR: 1.5,      // 레벨업 난이도 상승 계수 (1.5배씩 증가)
    SYNC_INTERVAL: 5000        // 서버 동기화 주기 (5초)
};

// --- 2. 앱 상태 관리 ---
let state = {
    uid: null,                 // 현재 로그인한 유저 ID
    friendUid: null,           // 구경 중인 친구 ID
    displayName: '여행자',
    totalExp: 0,
    multiplierExpiry: 0,       // 부스트 종료 시간 (Timestamp)
    isPressing: false,
    lastSyncTime: 0
};

// --- 3. 초기화 (페이지 로드 시) ---
window.onload = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    state.uid = urlParams.get('uid');
    state.friendUid = urlParams.get('friend');

    if (state.friendUid) {
        // [친구 방문 모드]
        initFriendMode(state.friendUid);
    } else if (state.uid) {
        // [내 트리 모드]
        initUserMode(state.uid);
    } else {
        // [로그인 전]
        showSection('login-section');
    }

    // 공통: 애니메이션 루프 및 자동 성장 루프 시작
    startGameLoops();
    setupEventListeners();
};

// --- 4. 초기화 함수들 ---
async function initUserMode(uid) {
    showSection('game-section');
    await loadData(uid);
    
    // 내 트리인 경우에만 공유 버튼 활성화
    document.getElementById('share-btn').onclick = () => {
        const url = `${window.location.origin}?friend=${state.uid}`;
        navigator.clipboard.writeText(url).then(() => alert("초대 링크가 복사되었습니다! 친구에게 공유해보세요."));
    };
}

async function initFriendMode(fUid) {
    showSection('game-section');
    document.getElementById('friend-visit-section').classList.remove('hidden');
    document.getElementById('grow-btn').classList.add('hidden'); // 친구 트리는 못 누름
    
    await loadData(fUid);
    
    document.getElementById('friend-name').innerText = state.displayName;
    document.getElementById('cheer-btn').onclick = async () => {
        const msg = document.getElementById('cheer-message').value || "메리 크리스마스!";
        await cheerFriend(fUid, msg);
    };
}

async function loadData(targetUid) {
    try {
        const res = await fetch(`/api/get-user?uid=${targetUid}`);
        const data = await res.json();
        state.totalExp = data.total_exp || 0;
        state.displayName = data.display_name || '이름없음';
        state.multiplierExpiry = data.multiplier_expiry || 0;
        updateUI();
    } catch (e) {
        console.error("데이터 로드 실패", e);
    }
}

// --- 5. 게임 핵심 로직 (성장 및 루프) ---
function startGameLoops() {
    // 자동 성장 (1초마다)
    setInterval(() => {
        if (state.friendUid) return; // 친구 트리는 자동 성장 안 시킴 (보기만 함)
        
        const isBoosted = state.multiplierExpiry > Date.now();
        let gain = CONFIG.BASE_XP_PER_SECOND;
        if (isBoosted) gain *= 2; // 친구 응원 버프
        
        state.totalExp += gain;
        updateUI();
    }, 1000);

    // 길게 누르기 체크 (0.1초마다)
    setInterval(() => {
        if (state.isPressing && !state.friendUid) {
            state.totalExp += CONFIG.PRESS_XP_PER_TICK;
            updateUI();
        }
    }, 100);

    // 서버 동기화 (5초마다)
    setInterval(() => {
        if (state.uid && !state.friendUid) syncData();
    }, CONFIG.SYNC_INTERVAL);
}

// --- 6. 계산 및 UI 업데이트 ---
function calculateLevel(totalExp) {
    let level = 1;
    let tempExp = totalExp;
    let required = CONFIG.LEVEL_UP_BASE;

    while (tempExp >= required) {
        tempExp -= required;
        level++;
        required *= CONFIG.LEVEL_UP_FACTOR;
    }
    return { level, currentExp: tempExp, required };
}

function updateUI() {
    const { level, currentExp, required } = calculateLevel(state.totalExp);
    const progress = (currentExp / required) * 100;
    
    // 트리 단계별 이모지
    let emoji = '🌱';
    if (level >= 3) emoji = '🌿';
    if (level >= 7) emoji = '🌲';
    if (level >= 15) emoji = '🎄';

    const treeContainer = document.getElementById('tree-container');
    treeContainer.innerText = emoji;
    
    // 성장 시각화 (스케일링)
    const scale = 1 + (level * 0.05) + (currentExp / required * 0.1);
    treeContainer.style.transform = `scale(${scale})`;

    // 텍스트 정보
    document.getElementById('level-display').innerText = `Lv.${level} 트리`;
    document.getElementById('exp-display').innerText = `${Math.floor(currentExp)} / ${Math.floor(required)} XP`;
    document.getElementById('progress-bar').style.width = `${progress}%`;

    // 부스트 뱃지 표시
    const isBoosted = state.multiplierExpiry > Date.now();
    document.getElementById('boost-badge').classList.toggle('hidden', !isBoosted);
}

// --- 7. 이벤트 핸들러 ---
function setupEventListeners() {
    const growBtn = document.getElementById('grow-btn');
    const loginBtn = document.getElementById('google-login-btn');

    // 길게 누르기 (마우스 & 터치)
    const startPress = () => { state.isPressing = true; };
    const endPress = () => { state.isPressing = false; syncData(); };

    growBtn.addEventListener('mousedown', startPress);
    growBtn.addEventListener('mouseup', endPress);
    growBtn.addEventListener('mouseleave', endPress);
    growBtn.addEventListener('touchstart', (e) => { e.preventDefault(); startPress(); });
    growBtn.addEventListener('touchend', endPress);

    // 로그인 버튼
    loginBtn.onclick = () => { location.href = '/api/auth/google'; };
}

// --- 8. 서버 통신 함수 ---
async function syncData() {
    if (!state.uid) return;
    try {
        await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ uid: state.uid, totalExp: state.totalExp })
        });
    } catch (e) { console.error("동기화 실패", e); }
}

async function cheerFriend(fUid, message) {
    try {
        const res = await fetch('/api/cheer', {
            method: 'POST',
            body: JSON.stringify({ friendUid: fUid, message, senderName: "친구" })
        });
        if (res.ok) {
            alert("응원을 보냈습니다! 친구의 트리가 10분간 더 빨리 자랍니다. ⚡");
            location.reload(); // 상태 새로고침
        }
    } catch (e) { alert("응원 보내기 실패"); }
}

function showSection(id) {
    document.getElementById('login-section').classList.add('hidden');
    document.getElementById('game-section').classList.add('hidden');
    document.getElementById(id).classList.remove('hidden');
}
