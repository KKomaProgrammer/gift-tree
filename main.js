(function () {
    const CONFIG = {
        BASE_XP: 10,
        GROWTH_FACTOR: 1.3,
        DAILY_XP: 20,
        INITIAL_SCALE: 1.5,
        MAX_SCALE: 2.8
    };

    let state = {
        myUid: null,           // 로그인한 내 ID
        viewingUid: null,      // 현재 보고 있는 트리의 주인 ID
        isOwner: false,
        totalExp: 0,
        hasContributedToday: false
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const urlUid = urlParams.get('uid');       // 로그인 후 전달된 내 ID
        const friendUid = urlParams.get('friend'); // 공유 링크 ID
        const savedUid = localStorage.getItem('my_tree_uid');

        // 1. 로그인 상태 확인 (내 ID 저장)
        if (urlUid) {
            state.myUid = urlUid;
            localStorage.setItem('my_tree_uid', urlUid);
            // URL 파라미터 청소
            window.history.replaceState({}, '', location.pathname + (friendUid ? `?friend=${friendUid}` : ''));
        } else {
            state.myUid = savedUid;
        }

        // 2. 누구의 트리를 볼지 결정
        state.viewingUid = friendUid || state.myUid;
        state.isOwner = (state.viewingUid === state.myUid && state.myUid !== null);

        // 3. UI 분기 처리
        if (!state.myUid) {
            // 로그인 안됨 -> 무조건 로그인 섹션 노출
            showSection('login-section');
            if (friendUid) document.getElementById('sub-title').innerText = "로그인해야 친구의 트리에 기여할 수 있습니다.";
        } else {
            // 로그인 됨 -> 게임 화면 노출
            await loadData();
            showSection('game-section');
            
            if (state.isOwner) {
                document.getElementById('owner-controls').classList.remove('hidden');
                document.getElementById('friend-controls').classList.add('hidden');
            } else {
                document.getElementById('owner-controls').classList.add('hidden');
                document.getElementById('friend-controls').classList.remove('hidden');
                document.getElementById('sub-title').innerText = "친구의 트리를 함께 키우고 있습니다.";
            }
        }

        setupEvents();
    };

    const loadData = async () => {
        try {
            // 기여 여부 확인을 위해 '내 ID'로 조회
            const res = await fetch(`/api/get-user?uid=${state.viewingUid}&viewer=${state.myUid}`);
            const data = await res.json();
            
            state.totalExp = data.total_exp || 0;
            const today = new Date().toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' });
            
            // 서버에서 넘어온 '마지막 기여 날짜'와 오늘 날짜 비교
            state.hasContributedToday = (data.viewer_last_contribution === today);
            
            updateUI();
        } catch (e) { console.error("데이터 로드 실패"); }
    };

    const updateUI = () => {
        let tempExp = state.totalExp;
        let level = 1;
        let req = CONFIG.BASE_XP;
        while (tempExp >= req) { tempExp -= req; level++; req = Math.floor(req * CONFIG.GROWTH_FACTOR); }

        const progress = (tempExp / req) * 100;
        const treeImg = document.getElementById('tree-image');
        
        let scale = CONFIG.INITIAL_SCALE + (level * 0.08) + (tempExp / req * 0.08);
        treeImg.style.transform = `scale(${Math.min(scale, CONFIG.MAX_SCALE)})`;

        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${req} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;

        // 기여 버튼 상태 제어 (내 트리 버튼 / 친구 트리 버튼 공통)
        const dailyBtn = document.getElementById('daily-btn');
        const cheerBtn = document.getElementById('cheer-btn');

        if (state.hasContributedToday) {
            [dailyBtn, cheerBtn].forEach(btn => {
                btn.innerText = "오늘 기여 완료!";
                btn.disabled = true;
                btn.style.opacity = "0.5";
            });
        }
    };

    const contribute = async (type) => {
        if (state.hasContributedToday || !state.myUid) return;

        const message = document.getElementById('cheer-message').value || "정성을 보냈습니다!";
        
        const res = await fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ 
                uid: state.viewingUid, // 누구 트리인지
                contributor: state.myUid, // 누가 했는지
                gainedExp: CONFIG.DAILY_XP,
                isDaily: true,
                message: message
            })
        });

        const result = await res.json();
        if (result.success) {
            alert("정성이 전달되었습니다! 트리가 성장합니다.");
            location.reload();
        } else {
            alert(result.message);
        }
    };

    const setupEvents = () => {
        document.getElementById('daily-btn').onclick = () => contribute('daily');
        document.getElementById('cheer-btn').onclick = () => contribute('cheer');
        document.getElementById('google-login-btn').onclick = () => {
            const friendParam = new URLSearchParams(window.location.search).get('friend');
            location.href = `/api/auth/google${friendParam ? '?friend=' + friendParam : ''}`;
        };
        document.getElementById('share-btn').onclick = () => {
            const url = `${window.location.origin}?friend=${state.myUid}`;
            navigator.clipboard.writeText(url).then(() => alert("링크 복사 완료!"));
        };
    };

    function showSection(id) {
        document.getElementById('login-section').classList.add('hidden');
        document.getElementById('game-section').classList.add('hidden');
        document.getElementById(id).classList.remove('hidden');
    }

    init();
})();
