(function () {
    const CONFIG = {
        BASE_XP: 10,
        GROWTH_FACTOR: 1.3,
        AUTO_XP_TICK: 0.1,    // 1초당 자동 성장
        PRESS_XP_TICK: 0.5,   // 0.1초당 꾹 누르기 가속
        DAILY_XP: 20,         // 매일 버튼 보너스
        INITIAL_SCALE: 1.5,
        SYNC_INTERVAL: 5000
    };

    let state = {
        uid: null,
        isOwner: false,
        totalExp: 0,
        isPressing: false,
        multiplierExpiry: 0,
        hasContributedToday: false
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const friendUid = urlParams.get('friend');
        const savedUid = localStorage.getItem('my_tree_uid');

        if (friendUid) {
            state.uid = friendUid; state.isOwner = false;
        } else if (urlUid || savedUid) {
            state.uid = urlUid || savedUid;
            state.isOwner = true;
            localStorage.setItem('my_tree_uid', state.uid);
            if (urlUid) window.history.replaceState({}, '', location.pathname);
        }

        if (state.uid) {
            await loadData();
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('game-section').classList.remove('hidden');
            if (!state.isOwner) setupFriendMode();
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
            
            const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
            state.hasContributedToday = (data.last_contribution_date === today);
            
            updateUI();
        } catch (e) { console.error("Data Load Error"); }
    };

    const updateUI = () => {
        let tempExp = state.totalExp;
        let level = 1;
        let req = CONFIG.BASE_XP;
        while (tempExp >= req) { tempExp -= req; level++; req = Math.floor(req * CONFIG.GROWTH_FACTOR); }

        const progress = (tempExp / req) * 100;
        const treeImg = document.getElementById('tree-image');
        const scale = CONFIG.INITIAL_SCALE + (level * 0.1) + (tempExp / req * 0.1);
        treeImg.style.transform = `scale(${scale})`;

        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${req} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        // 부스트 표시
        const isBoosted = state.multiplierExpiry > Date.now();
        document.getElementById('boost-badge').classList.toggle('hidden', !isBoosted);

        // 매일 버튼 상태
        const dBtn = document.getElementById('daily-btn');
        if (state.hasContributedToday) {
            dBtn.innerText = "오늘 기여 완료!";
            dBtn.disabled = true; dBtn.style.opacity = "0.5";
        }
    };

    const startLoops = () => {
        // 자동 성장 및 꾹 누르기 가속
        setInterval(() => {
            if (!state.isOwner) return;
            const isBoosted = state.multiplierExpiry > Date.now();
            let gain = CONFIG.AUTO_XP_TICK / 10; // 0.1초 기준
            if (isBoosted) gain *= 2;
            if (state.isPressing) gain += CONFIG.PRESS_XP_TICK;
            
            state.totalExp += gain;
            updateUI();
        }, 100);

        setInterval(() => { if (state.isOwner) syncData(); }, CONFIG.SYNC_INTERVAL);
    };

    const setupEvents = () => {
        const growBtn = document.getElementById('grow-btn');
        const dailyBtn = document.getElementById('daily-btn');
        const googleBtn = document.getElementById('google-login-btn');

        if (state.isOwner) {
            const start = (e) => { e.preventDefault(); state.isPressing = true; };
            const end = () => { state.isPressing = false; syncData(); };
            growBtn.onmousedown = start; growBtn.onmouseup = end; growBtn.onmouseleave = end;
            growBtn.ontouchstart = start; growBtn.ontouchend = end;

            dailyBtn.onclick = async () => {
                if (state.hasContributedToday) return;
                const res = await fetch('/api/sync', {
                    method: 'POST',
                    body: JSON.stringify({ uid: state.uid, gainedExp: CONFIG.DAILY_XP, isDaily: true })
                });
                const result = await res.json();
                if (result.success) { alert("오늘의 사랑이 전달되었습니다!"); location.reload(); }
                else { alert(result.message); }
            };
        }

        googleBtn.onclick = () => { location.href = '/api/auth/google'; };
        document.getElementById('share-btn').onclick = () => {
            const url = `${window.location.origin}?friend=${state.uid}`;
            navigator.clipboard.writeText(url).then(() => alert("링크 복사 완료!"));
        };
        
        document.getElementById('cheer-btn').onclick = async () => {
            const msg = document.getElementById('cheer-message').value || "메리 크리스마스!";
            await fetch('/api/cheer', {
                method: 'POST',
                body: JSON.stringify({ friendUid: state.uid, message: msg, senderName: "친구" })
            });
            alert("친구에게 부스트를 선물했습니다! ⚡");
            location.reload();
        };
    };

    const syncData = async () => {
        if (!state.uid || !state.isOwner) return;
        fetch('/api/sync', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ uid: state.uid, totalExp: state.totalExp, isDaily: false })
        });
    };

    function setupFriendMode() {
        document.getElementById('grow-btn').classList.add('hidden');
        document.getElementById('daily-btn').classList.add('hidden');
        document.getElementById('friend-visit-section').classList.remove('hidden');
        document.getElementById('sub-title').innerText = "친구의 트리에 응원을 남겨보세요!";
    }

    init();
})();
