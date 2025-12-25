(function () {
    // --- 1. 내부 설정값 (콘솔에서 수정 불가) ---
    const CONFIG = {
        BASE_XP: 10,            // 1단계 목표 (초반에 아주 빠르게 성장하도록 낮게 설정)
        GROWTH_FACTOR: 1.25,    // 다음 단계로 갈수록 필요 XP 1.25배씩 증가
        AUTO_XP: 0.05,          // 0.1초당 자동 성장량
        TICK_XP: 0.4,           // 0.1초당 누르기 성장량 (가속)
        SYNC_INTERVAL: 5000,    // 서버 동기화 주기 (5초)
        INITIAL_SCALE: 1.5,     // 초기 트리 크기 (크게 시작)
        MAX_LEVEL_SCALE: 5.0    // 최대 성장 크기 제한
    };

    // --- 2. 내부 상태 관리 ---
    let state = {
        uid: null,              // 현재 보고 있는 트리의 주인 ID
        isOwner: false,         // 내가 주인인지 여부
        totalExp: 0,            // 누적 XP
        isPressing: false,      // 누르고 있는지 여부
        multiplierExpiry: 0     // 부스트 만료 시간
    };

    // --- 3. 초기화 로직 ---
    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');       // 로그인 직후 넘어온 내 ID
        const friendUid = urlParams.get('friend'); // 공유 링크로 들어온 친구 ID
        const savedUid = localStorage.getItem('my_tree_uid'); // 기존 로그인 정보

        // 권한 확인 및 유저 설정
        if (friendUid) {
            // [친구 방문 모드]
            state.uid = friendUid;
            state.isOwner = false;
        } else if (urlUid || savedUid) {
            // [내 트리 모드]
            state.uid = urlUid || savedUid;
            state.isOwner = true;
            // 로컬 스토리지에 로그인 정보 보관
            localStorage.setItem('my_tree_uid', state.uid);
            
            // 깔끔한 URL을 위해 파라미터 제거 (선택 사항)
            if (urlUid) window.history.replaceState({}, '', location.pathname);
        }

        if (state.uid) {
            // UID가 있으면 게임 화면 표시 및 데이터 로드
            await loadUserData();
            showSection('game-section');
            if (!state.isOwner) setupFriendUI();
        } else {
            // 아무 정보 없으면 로그인 화면 표시
            showSection('login-section');
        }

        startLoops();
        setupEventListeners();
    };

    // --- 4. 데이터 로드 및 UI 업데이트 ---
    const loadUserData = async () => {
        try {
            const res = await fetch(`/api/get-user?uid=${state.uid}`);
            if (!res.ok) throw new Error("유저 정보 없음");
            const data = await res.json();
            state.totalExp = data.total_exp || 0;
            state.multiplierExpiry = data.multiplier_expiry || 0;
            updateUI();
        } catch (e) {
            console.error("Data Load Error:", e);
            updateUI(); // 실패해도 기본 UI는 그림
        }
    };

    const updateUI = () => {
        // 레벨 계산 (누적 XP 기반)
        let tempExp = state.totalExp;
        let level = 1;
        let required = CONFIG.BASE_XP;

        while (tempExp >= required) {
            tempExp -= required;
            level++;
            required = Math.floor(CONFIG.BASE_XP * Math.pow(CONFIG.GROWTH_FACTOR, level - 1));
        }

        const progress = (tempExp / required) * 100;
        
        // 트리 크기 성장 시각화 (초기 1.5배에서 시작하여 점점 커짐)
        const treeImg = document.getElementById('tree-image');
        let currentScale = CONFIG.INITIAL_SCALE + (level * 0.08) + (tempExp / required * 0.08);
        currentScale = Math.min(currentScale, CONFIG.MAX_LEVEL_SCALE); // 최대 크기 제한
        treeImg.style.transform = `scale(${currentScale})`;

        // 텍스트 및 프로그레스 바 업데이트
        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${required} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        // 부스트 상태 확인
        const isBoosted = state.multiplierExpiry > Date.now();
        document.getElementById('boost-badge').classList.toggle('hidden', !isBoosted);
    };

    // --- 5. 게임 루프 (성장 및 동기화) ---
    const startLoops = () => {
        // 자동 성장 및 입력 감지 (0.1초마다)
        setInterval(() => {
            if (!state.isOwner || !state.uid) return;

            const isBoosted = state.multiplierExpiry > Date.now();
            let gain = CONFIG.AUTO_XP;
            
            if (isBoosted) gain *= 2;      // 친구 응원 부스트
            if (state.isPressing) gain += CONFIG.TICK_XP; // 누르기 가속
            
            state.totalExp += gain;
            updateUI();
        }, 100);

        // 서버 데이터 저장 (5초마다)
        setInterval(() => {
            if (state.isOwner && state.uid) syncData();
        }, CONFIG.SYNC_INTERVAL);
    };

    // --- 6. 이벤트 및 통신 ---
    const setupEventListeners = () => {
        const growBtn = document.getElementById('grow-btn');
        const loginBtn = document.getElementById('google-login-btn');
        const shareBtn = document.getElementById('share-btn');

        // 길게 누르기 이벤트
        const startPress = (e) => { 
            if (e.type === 'touchstart') e.preventDefault();
            state.isPressing = true; 
        };
        const endPress = () => { state.isPressing = false; syncData(); };

        if (growBtn) {
            growBtn.onmousedown = startPress;
            growBtn.onmouseup = endPress;
            growBtn.onmouseleave = endPress;
            growBtn.ontouchstart = startPress;
            growBtn.ontouchend = endPress;
        }

        // 로그인 버튼
        if (loginBtn) {
            loginBtn.onclick = () => location.href = '/api/auth/google';
        }

        // 공유 버튼
        if (shareBtn) {
            shareBtn.onclick = () => {
                const url = `${window.location.origin}?friend=${state.uid}`;
                navigator.clipboard.writeText(url).then(() => alert("초대 링크 복사 완료!"));
            };
        }
    };

    const syncData = async () => {
        if (!state.isOwner) return;
        try {
            await fetch('/api/sync', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ uid: state.uid, totalExp: state.totalExp })
            });
        } catch (e) { console.error("Sync Error:", e); }
    };

    // 기타 유틸리티
    function showSection(id) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById(id).classList.remove('hidden');
    }

    function setupFriendUI() {
        document.getElementById('grow-btn').classList.add('hidden');
        document.getElementById('friend-visit-section').classList.remove('hidden');
        document.getElementById('sub-title').innerText = "친구의 트리를 감상하고 응원해보세요!";
    }

    // 실행
    init();
})();
