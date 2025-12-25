(function() {
    // 내부 변수: 외부 콘솔에서 접근 불가
    const CONFIG = {
        BASE_XP: 10,           
        GROWTH_FACTOR: 1.2,    
        TICK_XP: 0.5,          
        AUTO_XP: 0.05,         
        SYNC_INTERVAL: 5000,
        INITIAL_SCALE: 1.5     // 처음부터 트리를 조금 크게 설정
    };

    let state = {
        uid: null,
        isOwner: false,
        totalExp: 0,
        isPressing: false
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const friendUid = urlParams.get('friend');
        const loginUid = urlParams.get('uid'); // 로그인 후 전달되는 UID

        if (friendUid) {
            // 친구 페이지: 보기만 가능
            state.uid = friendUid;
            state.isOwner = false;
            await loadData(friendUid);
            document.getElementById('grow-btn').style.display = 'none'; // 버튼 숨김
            document.getElementById('friend-visit-section').classList.remove('hidden');
        } else if (loginUid) {
            // 내 페이지: 파라미터로 본인 확인 (로그인 직후)
            state.uid = loginUid;
            state.isOwner = true;
            await loadData(loginUid);
            document.getElementById('game-section').classList.remove('hidden');
            document.getElementById('login-section').classList.add('hidden');
        } else {
            // 로그인 필요
            document.getElementById('login-section').classList.remove('hidden');
        }

        startLoops();
        setupEvents();
    };

    const loadData = async (targetUid) => {
        const res = await fetch(`/api/get-user?uid=${targetUid}`);
        const data = await res.json();
        state.totalExp = data.total_exp || 0;
        updateUI();
    };

    const updateUI = () => {
        // 레벨 계산 로직
        let tempExp = state.totalExp;
        let level = 1;
        let required = CONFIG.BASE_XP;

        while (tempExp >= required) {
            tempExp -= required;
            level++;
            required = Math.floor(CONFIG.BASE_XP * Math.pow(CONFIG.GROWTH_FACTOR, level - 1));
        }

        const progress = (tempExp / required) * 100;
        
        // 시각적 성장: 트리가 점점 커짐 (초기 scale 1.5부터 시작)
        const treeImg = document.getElementById('tree-image');
        const currentScale = CONFIG.INITIAL_SCALE + (level * 0.1) + (tempExp / required * 0.1);
        treeImg.style.transform = `scale(${currentScale})`;

        // 텍스트 업데이트 (이모지 제거)
        document.getElementById('level-display').innerText = "단계 " + level;
        document.getElementById('exp-display').innerText = Math.floor(tempExp) + " / " + required + " XP";
        document.getElementById('progress-bar').style.width = progress + "%";
    };

    const startLoops = () => {
        // 자동 성장 및 누르기 체크
        setInterval(() => {
            if (!state.isOwner) return; 

            let gain = CONFIG.AUTO_XP;
            if (state.isPressing) gain += CONFIG.TICK_XP;
            
            state.totalExp += gain;
            updateUI();
        }, 100);

        // 서버 동기화
        setInterval(() => {
            if (state.isOwner) syncToServer();
        }, CONFIG.SYNC_INTERVAL);
    };

    const setupEvents = () => {
        const btn = document.getElementById('grow-btn');
        if (!btn) return;

        const start = () => { if(state.isOwner) state.isPressing = true; };
        const end = () => { state.isPressing = false; };

        btn.onmousedown = start;
        btn.onmouseup = end;
        btn.onmouseleave = end;
        btn.ontouchstart = (e) => { e.preventDefault(); start(); };
        btn.ontouchend = end;

        // 로그인 버튼
        document.getElementById('google-login-btn').onclick = () => {
            location.href = '/api/auth/google';
        };
    };

    const syncToServer = () => {
        fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: state.uid, totalExp: state.totalExp })
        });
    };

    init();
})();
