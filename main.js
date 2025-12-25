(function() {
    // 내부 변수 - 외부 콘솔에서 접근 불가
    const CONFIG = {
        BASE_XP: 10,           // 1단계 필요 XP (매우 낮게 설정하여 초기 성장 가속)
        GROWTH_FACTOR: 1.2,    // 다음 단계 필요 XP 증가율 (1.2배씩)
        TICK_XP: 0.5,          // 누를 때 증가량
        AUTO_XP: 0.1,          // 자동 성장량
        MAX_STAGE: 20          // 총 이미지 단계 수
    };

    let state = {
        uid: null,
        isOwner: false,
        totalExp: 0,
        currentLevel: 1,
        isPressing: false
    };

    // 이미지 매핑 (단계별 이미지 경로)
    const getTreeImage = (level) => {
        const stage = Math.min(level, CONFIG.MAX_STAGE);
        return `/images/tree_stage_${stage}.png`;
    };

    const init = async () => {
        const urlParams = new URLSearchParams(window.location.search);
        const friendUid = urlParams.get('friend');
        
        // 보안 핵심: 내 페이지는 로컬 스토리지의 토큰으로 판단 (URL 파라미터 조작 방지)
        const myAuthToken = localStorage.getItem('auth_token');

        if (friendUid) {
            // 친구 페이지 (조회 전용)
            state.uid = friendUid;
            state.isOwner = false;
            setupFriendView();
        } else if (myAuthToken) {
            // 내 페이지
            state.uid = myAuthToken;
            state.isOwner = true;
            setupOwnerView();
        } else {
            // 로그인 필요
            document.getElementById('login-section').classList.remove('hidden');
        }

        startLoops();
    };

    // 단계별 필요 XP 계산 공식: 초기에는 매우 빠름
    const getRequiredXp = (level) => {
        return Math.floor(CONFIG.BASE_XP * Math.pow(CONFIG.GROWTH_FACTOR, level - 1));
    };

    const updateUI = () => {
        let tempExp = state.totalExp;
        let level = 1;
        let required = getRequiredXp(level);

        // 누적 XP를 바탕으로 현재 레벨 계산
        while (tempExp >= required) {
            tempExp -= required;
            level++;
            required = getRequiredXp(level);
        }

        const progress = (tempExp / required) * 100;
        
        // 이미지 및 텍스트 업데이트
        const imgElement = document.getElementById('tree-image');
        const newSrc = getTreeImage(level);
        if (imgElement.src !== window.location.origin + newSrc) {
            imgElement.src = newSrc; // 레벨업 시 이미지 교체
        }

        // 성장 시각화 (진행도에 따라 미세하게 커짐)
        const scale = 1 + (progress / 1000);
        imgElement.style.transform = `scale(${scale})`;

        document.getElementById('level-display').innerText = `단계 ${level}`;
        document.getElementById('exp-display').innerText = `${Math.floor(tempExp)} / ${required} XP`;
        document.getElementById('progress-bar').style.width = `${progress}%`;
    };

    const startLoops = () => {
        // 자동 성장 및 누르기 체크
        setInterval(() => {
            if (!state.isOwner) return; // 본인만 성장 가능

            let gain = CONFIG.AUTO_XP;
            if (state.isPressing) gain += CONFIG.TICK_XP;
            
            state.totalExp += gain;
            updateUI();
        }, 100);

        // 서버 동기화 (주기적으로)
        setInterval(() => {
            if (state.isOwner) syncToServer();
        }, 5000);
    };

    const setupOwnerView = async () => {
        document.getElementById('game-section').classList.remove('hidden');
        const res = await fetch(`/api/get-user?uid=${state.uid}`);
        const data = await res.json();
        state.totalExp = data.total_exp;
        updateUI();

        // 버튼 이벤트 바인딩
        const growBtn = document.getElementById('grow-btn');
        growBtn.onmousedown = () => state.isPressing = true;
        growBtn.onmouseup = () => state.isPressing = false;
        growBtn.ontouchstart = (e) => { e.preventDefault(); state.isPressing = true; };
        growBtn.ontouchend = () => state.isPressing = false;
    };

    const syncToServer = () => {
        fetch('/api/sync', {
            method: 'POST',
            body: JSON.stringify({ uid: state.uid, totalExp: state.totalExp })
        });
    };

    init();
})();
