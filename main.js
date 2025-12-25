(function () {
    const CONFIG = {
        BASE_XP: 10,
        GROWTH_FACTOR: 1.25,
        AUTO_XP: 0.05,
        TICK_XP: 0.4,
        SYNC_INTERVAL: 5000,
        INITIAL_SCALE: 1.5 // 처음부터 1.5배 크게 시작
    };

    let state = {
        uid: null,
        isOwner: false,
        totalExp: 0,
        isPressing: false,
        multiplierExpiry: 0
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const friendUid = urlParams.get('friend');
        const savedUid = localStorage.getItem('my_tree_uid');

        // 1. 유저 상태 확인
        if (friendUid) {
            state.uid = friendUid;
            state.isOwner = false;
        } else if (urlUid || savedUid) {
            state.uid = urlUid || savedUid;
            state.isOwner = true;
            localStorage.setItem('my_tree_uid', state.uid);
            // URL 파라미터 숨기기
            if (urlUid) window.history.replaceState({}, '', location.pathname);
        }

        // 2. 화면 표시 로직
        if (state.uid) {
            await loadData();
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('game-section').classList.remove('hidden');
            
            if (!state.isOwner) {
                document.getElementById('grow-btn').classList.add('hidden');
                document.getElementById('friend-visit-section').classList.remove('hidden');
                document.getElementById('sub-title').innerText = "친구의 트리를 감상 중입니다";
            }
        }

        startLoops();
        setupEvents();
    };

    const loadData = async () => {
        try {
            const res = await fetch(`/api/get-user?uid=${state.uid}`);
            const data = await res.json();
            state.totalExp = data.total_exp || 0;
            state.multiplierExpiry = data.multiplier_expiry || 0;
            updateUI();
        } catch (e) {
            console.error("데이터 로드 실패:", e);
        }
    };

    const updateUI = () => {
        let tempExp = state.totalExp;
        let level = 1;
        let required = CONFIG.BASE_XP;

        while (tempExp >= required) {
            tempExp -= required;
            level++;
            required = Math.floor(CONFIG.BASE_XP * Math.pow(CONFIG.GROWTH_FACTOR, level - 1));
        }

        const progress = (tempExp / required) * 100;
        
        // 트리 크기 계산 (처음부터 크고, 갈수록 더 커짐)
        const treeImg = document.getElementById('tree-image');
        if (treeImg) {
            const scale = CONFIG.INITIAL_SCALE + (level * 0.1) + (tempExp / required * 0.1);
            treeImg.style.transform = `scale(${scale})`;
        }

        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${required} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        const isBoosted = state.multiplierExpiry > Date.now();
        document.getElementById('boost-badge').classList.toggle('hidden', !isBoosted);
    };

    const startLoops = () => {
        setInterval(() => {
            if (!state.isOwner) return;
            const isBoosted = state.multiplierExpiry > Date.now();
            let gain = CONFIG.AUTO_XP;
            if (isBoosted) gain *= 2;
            if (state.isPressing) gain += CONFIG.TICK_XP;
            
            state.totalExp += gain;
            updateUI();
        }, 100);

        setInterval(() => { if (state.isOwner) syncData(); }, CONFIG.SYNC_INTERVAL);
    };

    const setupEvents = () => {
        const growBtn = document.getElementById('grow-btn');
        if (growBtn) {
            const start = (e) => { e.preventDefault(); state.isPressing = true; };
            const end = () => { state.isPressing = false; };
            growBtn.onmousedown = start; growBtn.onmouseup = end; growBtn.onmouseleave = end;
            growBtn.ontouchstart = start; growBtn.ontouchend = end;
        }

        document.getElementById('google-login-btn').onclick = () => { location.href = '/api/auth/google'; };
        
        document.getElementById('share-btn').onclick = () => {
            const url = `${window.location.origin}?friend=${state.uid}`;
            navigator.clipboard.writeText(url).then(() => alert("링크 복사 완료!"));
        };
    };

    const syncData = async () => {
        if (!state.uid) return;
        fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: state.uid, totalExp: state.totalExp })
        });
    };

    init();
})();
