(function () {
    const CONFIG = {
        BASE_XP: 10,
        GROWTH_FACTOR: 1.3,
        DAILY_XP: 20,
        OWNER_TICK_XP: 0.5, // 주인이 0.1초당 얻는 가속 XP
        INITIAL_SCALE: 1.5,
        SYNC_INTERVAL: 4000
    };

    let state = {
        myUid: localStorage.getItem('my_tree_uid'),
        viewingUid: null,
        isOwner: false,
        isPressing: false,
        totalExp: 0,
        hasContributedToday: false
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const friendUid = urlParams.get('friend');

        // 1. 로그인 처리 및 URL 정리
        if (urlUid) {
            state.myUid = urlUid;
            localStorage.setItem('my_tree_uid', urlUid);
            // 메인 링크로 깔끔하게 청소 (단, 친구 정보는 유지)
            const cleanURL = window.location.origin + window.location.pathname + (friendUid ? `?friend=${friendUid}` : '');
            window.history.replaceState({}, '', cleanURL);
        }

        // 2. [핵심] 공유 링크 강제 로그인 확인
        // 공유 링크(?friend=)로 접속했는데 방금 로그인한 게 아니라면 무조건 로그인 버튼 노출
        if (friendUid && !urlUid) {
            showSection('login-section');
            document.getElementById('login-msg').innerText = "친구 링크를 통해 접속하셨습니다. 응원을 위해 다시 로그인해 주세요!";
            return;
        }

        // 3. 메인 게임 로직
        if (state.myUid) {
            state.viewingUid = friendUid || state.myUid;
            state.isOwner = (state.viewingUid === state.myUid);

            await loadData();
            showSection('game-section');
            
            // UID 표시
            document.getElementById('session-info').classList.remove('hidden');
            document.getElementById('display-uid').innerText = state.myUid;

            if (state.isOwner) {
                document.getElementById('grow-btn').classList.remove('hidden');
                document.getElementById('friend-controls').classList.add('hidden');
                document.getElementById('sub-title').innerText = "당신은 이 트리의 주인입니다.";
            } else {
                document.getElementById('grow-btn').classList.add('hidden');
                document.getElementById('daily-btn').classList.add('hidden');
                document.getElementById('friend-controls').classList.remove('hidden');
                document.getElementById('sub-title').innerText = "친구의 트리를 함께 키우고 있습니다.";
            }
        } else {
            showSection('login-section');
        }

        setupEvents();
        startLoops();
    };

    const loadData = async () => {
        try {
            const res = await fetch(`/api/get-user?uid=${state.viewingUid}&viewer=${state.myUid}`);
            const data = await res.json();
            state.totalExp = data.total_exp || 0;
            
            const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
            state.hasContributedToday = (data.viewer_last_contribution === today);
            updateUI();
        } catch (e) { console.error("Data Load Error"); }
    };

    const updateUI = () => {
        let tempExp = state.totalExp;
        let level = 1, req = CONFIG.BASE_XP;
        while (tempExp >= req) { tempExp -= req; level++; req = Math.floor(req * CONFIG.GROWTH_FACTOR); }

        const progress = (tempExp / req) * 100;
        const treeImg = document.getElementById('tree-image');
        const scale = CONFIG.INITIAL_SCALE + (level * 0.08) + (tempExp / req * 0.08);
        treeImg.style.transform = `scale(${Math.min(scale, 2.8)})`;

        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${req} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        // 기여 버튼 비활성화 (계정당 하루 1개 응원/기여 제한)
        if (state.hasContributedToday) {
            const dBtn = document.getElementById('daily-btn');
            const cBtn = document.getElementById('cheer-btn');
            if (dBtn) { dBtn.innerText = "오늘 기여 완료"; dBtn.disabled = true; dBtn.style.opacity = "0.5"; }
            if (cBtn) { cBtn.innerText = "오늘 응원 완료"; cBtn.disabled = true; cBtn.style.opacity = "0.5"; }
        }
    };

    const startLoops = () => {
        // 주인이 꾹 누를 때만 가속
        setInterval(() => {
            if (state.isOwner && state.isPressing) {
                state.totalExp += CONFIG.OWNER_TICK_XP;
                updateUI();
            }
        }, 100);

        setInterval(() => {
            if (state.isOwner && state.myUid) syncData(false);
        }, CONFIG.SYNC_INTERVAL);
    };

    const setupEvents = () => {
        const growBtn = document.getElementById('grow-btn');
        const start = (e) => { e.preventDefault(); state.isPressing = true; };
        const end = () => { state.isPressing = false; syncData(false); };

        if (growBtn) {
            growBtn.onmousedown = start; growBtn.onmouseup = end;
            growBtn.ontouchstart = start; growBtn.ontouchend = end;
        }

        document.getElementById('google-login-btn').onclick = () => {
            const f = new URLSearchParams(window.location.search).get('friend');
            location.href = `/api/auth/google${f ? '?friend=' + f : ''}`;
        };

        document.getElementById('daily-btn').onclick = () => syncData(true);
        document.getElementById('cheer-btn').onclick = () => syncData(true);
        
        document.getElementById('share-btn').onclick = () => {
            const url = `${window.location.origin}?friend=${state.myUid}`;
            navigator.clipboard.writeText(url).then(() => alert("링크 복사 완료!"));
        };
    };

    const syncData = async (isDaily) => {
        const res = await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({
                uid: state.viewingUid,
                contributor: state.myUid,
                totalExp: state.totalExp,
                gainedExp: isDaily ? CONFIG.DAILY_XP : 0,
                isDaily: isDaily
            })
        });
        if (isDaily) {
            const result = await res.json();
            if (result.success) { alert("정성이 전달되었습니다!"); location.reload(); }
            else { alert(result.message); }
        }
    };

    function showSection(id) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById(id).classList.remove('hidden');
    }

    init();
})();
            showSection('login-section');
        }

        setupEvents();
        startLoops();
    };

    const loadData = async () => {
        try {
            const res = await fetch(`/api/get-user?uid=${state.viewingUid}&viewer=${state.myUid}`);
            const data = await res.json();
            state.totalExp = data.total_exp || 0;
            const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
            state.hasContributedToday = (data.viewer_last_contribution === today);
            updateUI();
        } catch (e) { console.error("Load Error"); }
    };

    const updateUI = () => {
        let tempExp = state.totalExp;
        let level = 1, req = CONFIG.BASE_XP;
        while (tempExp >= req) { tempExp -= req; level++; req = Math.floor(req * CONFIG.GROWTH_FACTOR); }

        const progress = (tempExp / req) * 100;
        const treeImg = document.getElementById('tree-image');
        const scale = CONFIG.INITIAL_SCALE + (level * 0.08) + (tempExp / req * 0.08);
        treeImg.style.transform = `scale(${Math.min(scale, CONFIG.MAX_SCALE)})`;

        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${req} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        // 버튼 활성화 여부
        const dailyBtn = document.getElementById('daily-btn');
        const cheerBtn = document.getElementById('cheer-btn');
        if (state.hasContributedToday) {
            [dailyBtn, cheerBtn].forEach(b => { if(b) { b.innerText = "오늘 기여 완료!"; b.disabled = true; b.style.opacity = "0.5"; }});
        }
    };

    const startLoops = () => {
        setInterval(() => {
            if (state.isAdmin && state.isPressing && state.isOwner) {
                state.totalExp += CONFIG.ADMIN_TICK_XP;
                updateUI();
            }
        }, 100);
        setInterval(() => { if (state.isOwner && state.myUid) syncData(); }, CONFIG.SYNC_INTERVAL);
    };

    const setupEvents = () => {
        const adminBtn = document.getElementById('admin-grow-btn');
        const start = (e) => { e.preventDefault(); state.isPressing = true; };
        const end = () => { state.isPressing = false; syncData(); };

        if (adminBtn) {
            adminBtn.onmousedown = start; adminBtn.onmouseup = end;
            adminBtn.ontouchstart = start; adminBtn.ontouchend = end;
        }

        document.getElementById('daily-btn').onclick = () => contribute();
        document.getElementById('cheer-btn').onclick = () => contribute();
        document.getElementById('google-login-btn').onclick = () => {
            const f = new URLSearchParams(window.location.search).get('friend');
            location.href = `/api/auth/google${f ? '?friend=' + f : ''}`;
        };
        document.getElementById('share-btn').onclick = () => {
            const url = `${window.location.origin}?friend=${state.myUid}`;
            navigator.clipboard.writeText(url).then(() => alert("링크 복사 완료!"));
        };
    };

    const syncData = async () => {
        fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ 
                uid: state.viewingUid, 
                contributor: state.myUid, 
                totalExp: state.totalExp,
                isAdmin: state.isAdmin 
            })
        });
    };

    const contribute = async () => {
        if (state.hasContributedToday) return;
        const res = await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ uid: state.viewingUid, contributor: state.myUid, gainedExp: CONFIG.DAILY_XP, isDaily: true })
        });
        const result = await res.json();
        if (result.success) { alert("정성이 전달되었습니다!"); location.reload(); }
    };

    function showSection(id) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById(id).classList.remove('hidden');
    }

    init();
})();
