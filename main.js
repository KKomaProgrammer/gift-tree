(function () {
    const CONFIG = { BASE_XP: 10, GROWTH_FACTOR: 1.3, DAILY_XP: 20, OWNER_TICK_XP: 0.4, INITIAL_SCALE: 1.5 };
    let state = { myUid: localStorage.getItem('my_tree_uid'), viewingUid: null, isOwner: false, isPressing: false, totalExp: 0, hasContributedToday: false };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');
        const friendUid = urlParams.get('friend');

        if (urlUid) {
            state.myUid = urlUid;
            localStorage.setItem('my_tree_uid', urlUid);
            const cleanURL = window.location.origin + window.location.pathname + (friendUid ? `?friend=${friendUid}` : '');
            window.history.replaceState({}, '', cleanURL);
        }

        // 공유 링크 시 세션 무시하고 강제 로그인 유도
        if (friendUid && !urlUid) {
            showSection('login-section');
            document.getElementById('login-msg').innerText = "친구를 응원하려면 로그인이 필요합니다.";
            return;
        }

        if (state.myUid) {
            state.viewingUid = friendUid || state.myUid;
            state.isOwner = (state.viewingUid === state.myUid);
            await loadData();
            showSection('game-section');
            document.getElementById('session-info').classList.remove('hidden');
            document.getElementById('display-uid').innerText = state.myUid;

            if (state.isOwner) {
                document.getElementById('grow-btn').classList.remove('hidden');
                document.getElementById('friend-controls').classList.add('hidden');
            } else {
                document.getElementById('grow-btn').classList.add('hidden');
                document.getElementById('daily-btn').classList.add('hidden');
                document.getElementById('friend-controls').classList.remove('hidden');
            }
        } else {
            showSection('login-section');
        }
        setupEvents();
        startLoops();
    };

    const loadData = async () => {
        const res = await fetch(`/api/get-user?uid=${state.viewingUid}&viewer=${state.myUid}`);
        const data = await res.json();
        state.totalExp = data.total_exp || 0;
        const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
        state.hasContributedToday = (data.viewer_last_contribution === today);
        updateUI();
    };

    const updateUI = () => {
        let tempExp = state.totalExp, level = 1, req = CONFIG.BASE_XP;
        while (tempExp >= req) { tempExp -= req; level++; req = Math.floor(req * CONFIG.GROWTH_FACTOR); }
        const treeImg = document.getElementById('tree-image');
        treeImg.style.transform = `scale(${Math.min(CONFIG.INITIAL_SCALE + (level * 0.08) + (tempExp / req * 0.08), 2.8)})`;
        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${req} XP`;
        document.getElementById('progress-bar').style.width = `${(tempExp/req)*100}%`;

        if (state.hasContributedToday) {
            [document.getElementById('daily-btn'), document.getElementById('cheer-btn')].forEach(b => { if(b) { b.innerText = "오늘 완료"; b.disabled = true; b.style.opacity = "0.5"; }});
        }
    };

    const startLoops = () => {
        setInterval(() => { if (state.isOwner && state.isPressing) { state.totalExp += CONFIG.OWNER_TICK_XP; updateUI(); } }, 100);
        setInterval(() => { if (state.isOwner && state.myUid) sync(false); }, 4000);
    };

    const setupEvents = () => {
        const btn = document.getElementById('grow-btn');
        const start = (e) => { e.preventDefault(); state.isPressing = true; };
        const end = () => { state.isPressing = false; sync(false); };
        if (btn) { btn.onmousedown = start; btn.onmouseup = end; btn.ontouchstart = start; btn.ontouchend = end; }
        document.getElementById('google-login-btn').onclick = () => {
            const f = new URLSearchParams(window.location.search).get('friend');
            location.href = `/api/auth/google${f ? '?friend=' + f : ''}`;
        };
        document.getElementById('daily-btn').onclick = () => sync(true);
        document.getElementById('cheer-btn').onclick = () => sync(true);
        document.getElementById('share-btn').onclick = () => {
            navigator.clipboard.writeText(`${window.location.origin}?friend=${state.myUid}`).then(() => alert("링크 복사 완료!"));
        };
    };

    const sync = async (isDaily) => {
        const res = await fetch('/api/sync', { method: 'POST', body: JSON.stringify({ uid: state.viewingUid, contributor: state.myUid, totalExp: state.totalExp, gainedExp: isDaily ? CONFIG.DAILY_XP : 0, isDaily }) });
        if (isDaily) { const r = await res.json(); if (r.success) location.reload(); else alert(r.message); }
    };

    function showSection(id) { document.getElementById('login-section').classList.add('hidden'); document.getElementById('game-section').classList.add('hidden'); document.getElementById(id).classList.remove('hidden'); }
    init();
})();
