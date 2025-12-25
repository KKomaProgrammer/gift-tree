(function () {
    // [보안] 준우님의 실제 구글 UID를 여기에 넣으세요 (주소창 노출 X)
    const ADMIN_UID = "여기에_실제_UID_입력"; 

    const CONFIG = {
        BASE_XP: 10,
        GROWTH_FACTOR: 1.3,
        DAILY_XP: 20,
        ADMIN_TICK_XP: 0.5, 
        INITIAL_SCALE: 1.5,
        MAX_SCALE: 2.8,
        SYNC_INTERVAL: 4000
    };

    let state = {
        myUid: localStorage.getItem('my_tree_uid'),
        viewingUid: null,
        isOwner: false,
        isAdmin: false,
        isPressing: false,
        totalExp: 0,
        hasContributedToday: false
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const friendUid = urlParams.get('friend');

        // 1. 로그인 정보 저장 및 관리자 확인
        if (urlUid) {
            state.myUid = urlUid;
            localStorage.setItem('my_tree_uid', urlUid);
            // 깔끔한 URL 유지
            window.history.replaceState({}, '', location.pathname + (friendUid ? `?friend=${friendUid}` : ''));
        }
        
        state.isAdmin = (state.myUid === ADMIN_UID);

        // 2. 현재 뷰 설정
        state.viewingUid = friendUid || state.myUid;
        state.isOwner = (state.viewingUid === state.myUid && state.myUid !== null);

        // 3. UI 분기
        if (state.myUid) {
            await loadData();
            document.getElementById('login-section').classList.add('hidden');
            document.getElementById('game-section').classList.remove('hidden');
            
            // [중요] 친구 링크 접속 시에는 관리자 버튼 원천 봉쇄
            const adminBtn = document.getElementById('admin-grow-btn');
            if (state.isAdmin && state.isOwner && !friendUid) {
                adminBtn.classList.remove('hidden');
            } else {
                adminBtn.classList.add('hidden');
            }

            if (!state.isOwner) {
                document.getElementById('owner-controls')?.classList.add('hidden'); // 존재 시 숨김
                document.getElementById('friend-controls').classList.remove('hidden');
                document.getElementById('sub-title').innerText = "친구의 트리에 정성을 보태고 있습니다.";
            } else {
                document.getElementById('sub-title').innerText = "오늘의 정성을 담아 트리를 키워보세요.";
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
