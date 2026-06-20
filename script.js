    // ==========================================
        // 🧠 플래너 핵심 변수 (기능 원상복구 완비)
        // ==========================================
        let events = [];
        let todos = [];
        let currentWeekStart;

        let currentEditMode = null;
        let selectionStep = 0;
        let selectedDayStr = null;
        let tempStartSlot = null;
        let tempEndSlot = null;
        let activeEventId = null;
        let selectedColor = '#FFB3BA';

        // 🔐 인증 시스템 상태 변수
        let authName = '';
        let authUUID = '';
        let isSubmitting = false;

        const BACKEND_URL = "https://weplan-pro.vercel.app/api"; // Vercel API
        const CRYPTO_KEY = "MAX_PLANNER_SECRET_TOKEN_2026";

        const pastelColors = [
            '#FFB3BA', '#FFDFBA', '#FFF5BA', '#BFFCC6', '#C3E6CB', '#D6E4FF',
            '#E8D7FF', '#FFC6FF', '#F8C8DC', '#FFC0CB', '#FFB7B2', '#E8AEB7',
            '#FEF9E7', '#FCE19C', '#F7DC6F', '#FFF2CC', '#E2F0D9', '#D5F5E3'
        ];

        function encrypt(text) {
            let result = "";
            for (let i = 0; i < text.length; i++) {
                let charCode = text.charCodeAt(i) ^ CRYPTO_KEY.charCodeAt(i % CRYPTO_KEY.length);
                result += String.fromCharCode(charCode);
            }
            return btoa(encodeURIComponent(result));
        }
        function decrypt(cipher) {
            try {
                let decoded = decodeURIComponent(atob(cipher));
                let result = "";
                for (let i = 0; i < decoded.length; i++) {
                    let charCode = decoded.charCodeAt(i) ^ CRYPTO_KEY.charCodeAt(i % CRYPTO_KEY.length);
                    result += String.fromCharCode(charCode);
                }
                return result;
            } catch (e) { return ""; }
        }

        window.onload = function () {
            initSession();
            initDataLoad();
            initTimeAxis();
            initColorPicker();
            renderPlanner();

            document.addEventListener('click', (e) => {
                document.getElementById('context-menu').style.display = 'none';
                if (!e.target.closest('.io-controls')) closeAllMenus();
            });

            // 서버 통신 중 이탈 방지 락
            window.addEventListener('beforeunload', (e) => {
                if (isSubmitting) {
                    e.preventDefault();
                    e.returnValue = "서버와 통신 중입니다. 이 페이지를 나가시겠습니까?";
                }
            });

            setTimeout(() => {
                const loader = document.getElementById('refresh-loader');
                loader.style.opacity = '0';
                setTimeout(() => loader.style.display = 'none', 300);
            }, 600);
        }

        // ==========================================
        // 🔐 인증 시스템 UI 및 서버 로직
        // ==========================================
        function initSession() {
            const encName = localStorage.getItem('max_auth_name');
            const encUUID = localStorage.getItem('max_auth_uuid');
            if (encName && encUUID) {
                authName = decrypt(encName);
                authUUID = decrypt(encUUID);
            }
            renderAuthUI();
        }

        function renderAuthUI() {
            const area = document.getElementById('auth-area');
            if (authUUID) {
                area.innerHTML = `
                <button class="user-profile-btn" onclick="toggleDropdown('user-dropdown', event)">
                    𐙞 ${authName}
                </button>
                <div class="dropdown-menu" id="user-dropdown">
                    <div class="dropdown-item" onclick="toggleStatusPanel('save-panel', event)">☁️ 저장</div>
                    <div class="dropdown-item" onclick="toggleStatusPanel('load-panel', event)">☁️ 불러오기</div>
                    <div class="dropdown-item" style="color:var(--danger-color); border-top:1px solid #eee;" onclick="execLogout()">로그아웃</div>
                </div>
            `;
            } else {
                area.innerHTML = `
                <button class="user-profile-btn" onclick="openAuthModal('login')">
                    𐙞 로그인
                </button>
            `;
            }
        }

        function toggleDropdown(id, e) {
            e.stopPropagation(); closeAllMenus();
            document.getElementById(id).style.display = 'block';
        }
        function toggleStatusPanel(id, e) {
            e.stopPropagation(); closeAllMenus();
            document.getElementById(id).style.display = 'flex';
            if (id === 'save-panel') startCloudSave();
            if (id === 'load-panel') startCloudLoad();
        }
        function closeAllMenus() {
            document.querySelectorAll('.dropdown-menu, .status-panel').forEach(el => el.style.display = 'none');
        }

        function openAuthModal(mode) {
            document.getElementById('modal-auth').classList.add('active');
            slideAuth(mode);
        }

        function slideAuth(mode) {
            const slider = document.getElementById('auth-slider');
            const container = document.getElementById('auth-slider-container');
            const title = document.getElementById('auth-main-title');

            document.getElementById('log-id').value = ''; document.getElementById('log-pw').value = '';
            document.getElementById('reg-name').value = ''; document.getElementById('reg-id').value = '';
            document.getElementById('reg-pw').value = ''; document.getElementById('reg-pw2').value = '';
            document.getElementById('log-msg').innerText = ''; document.getElementById('reg-msg').innerText = '';

            if (mode === 'signup') {
                title.innerText = '회원가입';
                slider.style.transform = 'translateX(-50%)';
                container.style.height = '430px'; // 넓어진 폭에 맞는 비율
            } else {
                title.innerText = '로그인';
                slider.style.transform = 'translateX(0)';
                container.style.height = '280px';
            }
        }

        function closeAuthModal() {
            if (isSubmitting) return;
            document.getElementById('modal-auth').classList.remove('active');
        }
        function handleAuthOutsideClick(e) {
            if (isSubmitting) return;
            if (e.target === document.getElementById('modal-auth')) closeAuthModal();
        }
        function handleEnter(e, type) {
            if (e.key === 'Enter') {
                if (type === 'login') submitLogin();
            }
        }

        function validateReg() {
            const name = document.getElementById('reg-name').value.trim();
            const id = document.getElementById('reg-id').value.trim();
            const pw = document.getElementById('reg-pw').value;
            const pw2 = document.getElementById('reg-pw2').value;
            const msg = document.getElementById('reg-msg');
            const btn = document.getElementById('btn-signup');

            let valid = true;
            msg.className = 'validation-msg v-err';

            if (name.length > 10) { msg.innerText = '사용자명은 10자 이내입니다.'; valid = false; }
            else if (id.length > 0 && id.length < 4) { msg.innerText = '아이디는 4자 이상입니다.'; valid = false; }
            else if (pw.length > 0 && pw.length < 8) { msg.innerText = '비밀번호는 8자 이상입니다.'; valid = false; }
            else if (pw && pw2 && pw !== pw2) { msg.innerText = '비밀번호가 일치하지 않습니다.'; valid = false; }
            else if (name && id.length >= 4 && pw.length >= 8 && pw === pw2) {
                msg.className = 'validation-msg v-ok';
                msg.innerText = '조건을 모두 만족합니다.';
            } else { valid = false; msg.innerText = ''; }

            btn.disabled = !valid;
        }

        function setSubmitting(btnId, state) {
            isSubmitting = state;
            const btn = document.getElementById(btnId);
            const closeBtn = document.getElementById('auth-close-btn');
            if (state) {
                btn.innerHTML = `<div class="btn-spinner"></div>`;
                btn.disabled = true;
                closeBtn.style.opacity = '0.2';
                closeBtn.style.cursor = 'not-allowed';
            } else {
                btn.innerHTML = '→';
                btn.disabled = false;
                closeBtn.style.opacity = '1';
                closeBtn.style.cursor = 'pointer';
            }
        }

        async function submitSignup() {
            const name = document.getElementById('reg-name').value.trim();
            const id = document.getElementById('reg-id').value.trim();
            const pw = document.getElementById('reg-pw').value;
            const msg = document.getElementById('reg-msg');

            setSubmitting('btn-signup', true);
            msg.className = 'validation-msg v-err';

            try {
                const payload = encrypt(JSON.stringify({ name, id, pw }));
                const res = await fetch(`${BACKEND_URL}/auth/signup`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-App-Verification': 'MaxPlannerMaster2026' },
                    body: JSON.stringify({ payload })
                });

                const data = await res.json();
                if (res.ok) {
                    showToast("회원가입 성공! 로그인 해주세요.");
                    slideAuth('login');
                } else {
                    msg.innerText = data.error === 'duplicate' ? '❌ 사용할 수 없는 아이디입니다.' : '❌ 가입 오류 발생';
                }
            } catch (e) {
                msg.innerText = '❌ 서버 통신 오류';
            } finally {
                setSubmitting('btn-signup', false);
            }
        }

        async function submitLogin() {
            const id = document.getElementById('log-id').value.trim();
            const pw = document.getElementById('log-pw').value;
            const msg = document.getElementById('log-msg');

            if (!id || !pw) return;

            setSubmitting('btn-login', true);
            msg.innerText = '';

            try {
                const payload = encrypt(JSON.stringify({ id, pw }));
                const res = await fetch(`${BACKEND_URL}/auth/login`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-App-Verification': 'MaxPlannerMaster2026' },
                    body: JSON.stringify({ payload })
                });

                const data = await res.json();
                if (res.ok && data.uuid) {
                    localStorage.setItem('max_auth_uuid', encrypt(data.uuid));
                    localStorage.setItem('max_auth_name', encrypt(data.name));
                    authUUID = data.uuid;
                    authName = data.name;

                    // ❌ 기존 코드: closeAuthModal();
                    // 💡 변경 코드: 로그인 모달의 ID가 modal-auth인 경우 확실하게active 클래스를 제거합니다.
                    const authModal = document.getElementById('modal-auth');
                    if (authModal) {
                        authModal.classList.remove('active');
                    } else if (typeof closeModal === 'function') {
                        // 혹은 공통 closeModal 함수가 존재한다면 아래처럼 사용도 가능합니다.
                        closeModal('modal-auth');
                    }

                    if (typeof renderAuthUI === 'function') renderAuthUI();
                    showToast(`환영합니다, ${authName}님!`);
                } else {
                    msg.innerText = '❌ 아이디 또는 비밀번호가 불일치합니다.';
                }
            } catch (e) {
                msg.innerText = '❌ 서버 응답이 없습니다.';
            } finally {
                setSubmitting('btn-login', false);
            }
        }

        function execLogout() {
            authUUID = ''; authName = '';
            localStorage.removeItem('max_auth_uuid');
            localStorage.removeItem('max_auth_name');
            renderAuthUI();
            showToast("로그아웃 되었습니다.");
        }

        // ==========================================
        // ☁️ 클라우드 시스템 로직
        // ==========================================
        function updateProgress(barId, ratio) {
            const offset = 172.78 - (172.78 * ratio);
            document.getElementById(barId).style.strokeDashoffset = offset;
        }

        async function startCloudSave() {
            const textEl = document.getElementById('save-text');
            try {
                textEl.innerText = "암호화 및 전송 중"; updateProgress('save-bar', 0.5);

                const encryptedData = encrypt(JSON.stringify({ events, todos }));
                const encryptedUuid = encrypt(authUUID);

                const res = await fetch(`${BACKEND_URL}/planner`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-App-Verification': 'MaxPlannerMaster2026' },
                    body: JSON.stringify({ uuid: encryptedUuid, payload: encryptedData })
                });

                if (!res.ok) throw new Error();

                textEl.innerText = "저장 완료!"; updateProgress('save-bar', 1);
            } catch (err) {
                textEl.innerText = "❌ 저장 실패";
            } finally {
                setTimeout(closeAllMenus, 1500);
                setTimeout(() => updateProgress('save-bar', 0), 1800);
            }
        }

        async function startCloudLoad() {
            const textEl = document.getElementById('load-text');
            try {
                textEl.innerText = "서버 통신 중"; updateProgress('load-bar', 0.3);

                const encryptedUuid = encodeURIComponent(encrypt(authUUID));
                const res = await fetch(`${BACKEND_URL}/planner?uuid=${encryptedUuid}`, {
                    method: 'GET',
                    headers: { 'X-App-Verification': 'MaxPlannerMaster2026' }
                });

                if (!res.ok) throw new Error();
                const data = await res.json();

                textEl.innerText = "복호화 및 적용 중"; updateProgress('load-bar', 0.7);

                if (data.payload) {
                    const parsed = JSON.parse(decrypt(data.payload));
                    events = parsed.events || [];
                    todos = parsed.todos || [];
                    saveToStorage();
                    renderPlanner();
                }

                textEl.innerText = "불러오기 완료!"; updateProgress('load-bar', 1);
            } catch (err) {
                textEl.innerText = "❌ 로드 실패";
            } finally {
                setTimeout(closeAllMenus, 1500);
                setTimeout(() => updateProgress('load-bar', 0), 1800);
            }
        }

        // ==========================================
        // 🧠 기존 플래너 UI/기능 완벽 복구 (삭제된 코드 없음)
        // ==========================================
        function initDataLoad() {
            const encEvents = localStorage.getItem('max_enc_events');
            const encTodos = localStorage.getItem('max_enc_todos');

            if (encEvents) events = JSON.parse(decrypt(encEvents)) || [];
            else events = JSON.parse(localStorage.getItem('max_planner_events')) || [];

            if (encTodos) todos = JSON.parse(decrypt(encTodos)) || [];
            else todos = JSON.parse(localStorage.getItem('max_planner_todos')) || [];

            let savedWeek = localStorage.getItem('max_planner_current_week');
            currentWeekStart = savedWeek ? new Date(savedWeek) : getStartOfWeek(new Date());
        }

        function saveToStorage() {
            localStorage.setItem('max_planner_events', JSON.stringify(events));
            localStorage.setItem('max_planner_todos', JSON.stringify(todos));
            localStorage.setItem('max_enc_events', encrypt(JSON.stringify(events)));
            localStorage.setItem('max_enc_todos', encrypt(JSON.stringify(todos)));
            localStorage.setItem('max_planner_current_week', currentWeekStart.toISOString());
        }

        function getStartOfWeek(d) {
            const date = new Date(d); const day = date.getDay();
            const diff = date.getDate() - day + (day === 0 ? -6 : 1);
            return new Date(date.setDate(diff));
        }
        function formatDate(date) { return date.toISOString().split('T')[0]; }

        function initTimeAxis() {
            const axis = document.getElementById('time-axis');
            axis.innerHTML = '';
            for (let i = 0; i < 24; i++) {
                const label = document.createElement('div');
                label.className = 'time-label';
                label.innerText = String(i).padStart(2, '0') + ':00';
                axis.appendChild(label);
            }
        }

        function initColorPicker() {
            const grid = document.getElementById('color-picker-grid');
            grid.innerHTML = '';
            pastelColors.forEach(color => {
                const cell = document.createElement('div');
                cell.className = 'color-cell';
                cell.style.backgroundColor = color;
                cell.dataset.color = color;
                cell.onclick = function () {
                    document.querySelectorAll('.color-cell').forEach(c => c.classList.remove('selected'));
                    cell.classList.add('selected');
                    selectedColor = color;
                };
                grid.appendChild(cell);
            });
        }

        function changeWeek(direction) {
            currentWeekStart.setDate(currentWeekStart.getDate() + (direction * 7));
            localStorage.setItem('max_planner_current_week', currentWeekStart.toISOString());
            renderPlanner();
        }

        function renderPlanner() {
            const weekGrid = document.getElementById('week-grid');
            const todoGrid = document.getElementById('todo-grid');
            weekGrid.innerHTML = '';
            todoGrid.innerHTML = '';

            const daysOfWeek = ['월', '화', '수', '목', '금', '토', '일'];
            let currentIterDate = new Date(currentWeekStart);

            const midWeekDate = new Date(currentWeekStart);
            midWeekDate.setDate(midWeekDate.getDate() + 3);
            document.getElementById('week-title').innerText = `${midWeekDate.getFullYear()}년 ${String(midWeekDate.getMonth() + 1).padStart(2, '0')}월`;

            const todayStr = formatDate(new Date());

            for (let i = 0; i < 7; i++) {
                const dateStr = formatDate(currentIterDate);
                const dayNum = currentIterDate.getDate();
                const isToday = (dateStr === todayStr);

                const col = document.createElement('div');
                col.className = 'day-column';
                col.dataset.date = dateStr;

                const header = document.createElement('div');
                header.className = `day-header ${isToday ? 'today' : ''}`;
                header.innerHTML = `<div>${daysOfWeek[i]}</div><div style="font-size:11px; opacity:0.7;">${dayNum}일</div>`;
                col.appendChild(header);

                const slotsContainer = document.createElement('div');
                slotsContainer.className = 'slots-container';

                for (let s = 0; s < 144; s++) {
                    const slot = document.createElement('div');
                    slot.className = 'slot';
                    slot.dataset.slotIndex = s;
                    slot.onclick = () => handleSlotClick(dateStr, s);
                    slotsContainer.appendChild(slot);
                }

                const dayEvents = events.filter(e => e.dateStr === dateStr);
                dayEvents.forEach(ev => {
                    const block = document.createElement('div');
                    block.className = 'event-block';
                    block.style.backgroundColor = ev.color;
                    block.dataset.id = ev.id;

                    const topPx = ev.startSlot * 8;
                    const heightPx = (ev.endSlot - ev.startSlot + 1) * 8;
                    block.style.top = `${topPx}px`;
                    block.style.height = `${heightPx}px`;

                    if (currentEditMode === 'adjust' && ev.id === activeEventId) {
                        block.classList.add('adjusting');
                    }

                    const durationMin = (ev.endSlot - ev.startSlot + 1) * 10;
                    block.innerHTML = `<div style="font-weight:700; overflow:hidden; text-overflow:ellipsis;">${ev.title}</div><div>${durationMin}분</div>`;

                    block.onclick = (e) => { e.stopPropagation(); openDetailPopup(ev); };
                    block.oncontextmenu = (e) => { e.preventDefault(); e.stopPropagation(); openContextMenu(e, ev.id); };

                    slotsContainer.appendChild(block);
                });

                col.appendChild(slotsContainer);
                weekGrid.appendChild(col);

                const todoCol = document.createElement('div');
                todoCol.className = 'todo-column';

                const inputWrapper = document.createElement('div');
                inputWrapper.className = 'todo-input-wrapper';
                inputWrapper.innerHTML = `
                <input type="text" class="todo-input" id="input-todo-${dateStr}" placeholder="할 일 추가...">
                <button class="btn-todo-add" onclick="addTodo('${dateStr}')">+</button>
            `;
                todoCol.appendChild(inputWrapper);

                const todoList = document.createElement('ul');
                todoList.className = 'todo-list';

                const dayTodos = todos.filter(t => t.dateStr === dateStr);
                dayTodos.forEach(t => {
                    const li = document.createElement('li');
                    li.className = `todo-item ${t.completed ? 'completed' : ''}`;
                    li.innerHTML = `
                    <div style="display:flex; align-items:center; overflow:hidden;">
                        <input type="checkbox" ${t.completed ? 'checked' : ''} onchange="toggleTodo('${t.id}')">
                        <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${t.text}</span>
                    </div>
                    <button class="btn-todo-del" onclick="deleteTodo('${t.id}')">×</button>
                `;
                    todoList.appendChild(li);
                });
                todoCol.appendChild(todoList);
                todoGrid.appendChild(todoCol);

                currentIterDate.setDate(currentIterDate.getDate() + 1);
            }

            if (currentEditMode === 'add' || currentEditMode === 'adjust') {
                document.getElementById('week-grid').classList.add('selection-active');
            } else {
                document.getElementById('week-grid').classList.remove('selection-active');
            }
        }

        function toggleSelectionMode() {
            const btn = document.getElementById('btn-add-mode');
            if (currentEditMode === 'add') {
                resetSelectionModeState();
            } else {
                currentEditMode = 'add';
                selectionStep = 0;
                clearTempSelectionStyles();
                btn.innerText = '선택 취소';
                btn.style.backgroundColor = '#4b5563';

                const banner = document.getElementById('selection-banner');
                banner.style.display = 'block';
                banner.style.backgroundColor = '#e0e7ff';
                banner.style.color = '#3730a3';
                banner.innerText = '🕒 [공부 추가 모드] 원하는 요일 칸에서 [시작 시간] 클릭 후 [종료 시간] 셀을 한 번 더 클릭하세요.';
                document.getElementById('week-grid').classList.add('selection-active');
            }
        }

        function resetSelectionModeState() {
            currentEditMode = null;
            selectionStep = 0;
            const btn = document.getElementById('btn-add-mode');
            const banner = document.getElementById('selection-banner');
            btn.innerText = '+ 공부 추가';
            btn.style.backgroundColor = 'var(--primary-color)';
            banner.style.display = 'none';
            document.getElementById('week-grid').classList.remove('selection-active');
            clearTempSelectionStyles();
            renderPlanner();
        }

        function handleSlotClick(dateStr, slotIndex) {
            if (currentEditMode !== 'add' && currentEditMode !== 'adjust') return;

            if (selectionStep === 0) {
                selectedDayStr = dateStr;
                tempStartSlot = slotIndex;
                selectionStep = 1;
                clearTempSelectionStyles();
                highlightSlot(dateStr, slotIndex);
            } else if (selectionStep === 1) {
                if (dateStr !== selectedDayStr) {
                    showToast("같은 날짜 안에서 영역을 할당해 주세요.");
                    return;
                }

                tempEndSlot = slotIndex;
                const finalStart = Math.min(tempStartSlot, tempEndSlot);
                const finalEnd = Math.max(tempStartSlot, tempEndSlot);

                const excludeId = (currentEditMode === 'adjust') ? activeEventId : null;
                if (checkOverlap(dateStr, finalStart, finalEnd, excludeId)) {
                    showToast("다른 항목과 겹칠 수 없습니다!");
                    clearTempSelectionStyles();
                    selectionStep = 0;
                    return;
                }

                tempStartSlot = finalStart;
                tempEndSlot = finalEnd;
                selectionStep = 2;
                openPlannerModal(currentEditMode);
            }
        }

        function highlightSlot(dateStr, slot) {
            const col = document.querySelector(`.day-column[data-date="${dateStr}"]`);
            if (col) {
                const slotEl = col.querySelector(`.slot[data-slot-index="${slot}"]`);
                if (slotEl) slotEl.classList.add('selected-temp');
            }
        }

        function clearTempSelectionStyles() { document.querySelectorAll('.slot').forEach(s => s.classList.remove('selected-temp')); }

        function checkOverlap(dateStr, start, end, excludeId = null) {
            return events.some(ev => {
                if (excludeId && ev.id === excludeId) return false;
                if (ev.dateStr !== dateStr) return false;
                return (start <= ev.endSlot && end >= ev.startSlot);
            });
        }

        function slotToTimeStr(slot) {
            const totalMin = slot * 10;
            return `${String(Math.floor(totalMin / 60)).padStart(2, '0')}:${String(totalMin % 60).padStart(2, '0')}`;
        }

        function openPlannerModal(mode) {
            const modal = document.getElementById('modal-planner');
            const s1View = document.getElementById('step-1-view');
            const s2View = document.getElementById('step-2-view');
            const mainTitle = document.getElementById('modal-main-title');
            const nextBtn = document.getElementById('btn-step1-next');

            modal.classList.add('active');
            const timeText = `${slotToTimeStr(tempStartSlot)} ~ ${slotToTimeStr(tempEndSlot + 1)}`;
            document.getElementById('selected-time-range-text').innerText = timeText;

            if (mode === 'add' || mode === 'adjust') {
                s1View.style.display = 'block';
                s2View.style.display = 'none';
                if (mode === 'add') {
                    mainTitle.innerText = "새 공부 기록하기"; nextBtn.innerText = "다음";
                    document.getElementById('input-title').value = ''; document.getElementById('input-content').value = '';
                    activeEventId = null;
                } else {
                    mainTitle.innerText = "변경할 기간 확인"; nextBtn.innerText = "완료";
                }
            } else if (mode === 'edit') {
                mainTitle.innerText = "내용 변경하기"; s1View.style.display = 'none'; s2View.style.display = 'block';
                const ev = events.find(e => e.id === activeEventId);
                if (ev) {
                    document.getElementById('input-title').value = ev.title;
                    document.getElementById('input-content').value = ev.content;
                    selectedColor = ev.color;
                }
            }
        }

        function closeModal(id) {
            document.getElementById(id).classList.remove('active');
            if (id === 'modal-planner') resetSelectionModeState();
        }

        function handleOutsideClick(e, modalId) { if (e.target === document.getElementById(modalId)) closeModal(modalId); }

        function goToStep2() {
            const nextBtn = document.getElementById('btn-step1-next');
            if (nextBtn.innerText === "완료") {
                const ev = events.find(e => e.id === activeEventId);
                if (ev) {
                    ev.startSlot = tempStartSlot; ev.endSlot = tempEndSlot;
                    saveToStorage(); showToast("기간 수정 완료!");
                }
                closeModal('modal-planner');
            } else {
                document.getElementById('step-1-view').style.display = 'none';
                document.getElementById('step-2-view').style.display = 'block';
            }
        }

        function reselectTime() {
            const mode = currentEditMode; closeModal('modal-planner');
            currentEditMode = mode; selectionStep = 0; clearTempSelectionStyles();
            document.getElementById('btn-add-mode').innerText = '선택 취소';
            const banner = document.getElementById('selection-banner');
            banner.style.display = 'block';
            renderPlanner();
        }

        function saveEvent() {
            const title = document.getElementById('input-title').value.trim() || "공부 항목";
            const content = document.getElementById('input-content').value.trim();

            if (activeEventId && currentEditMode === 'edit') {
                const ev = events.find(e => e.id === activeEventId);
                if (ev) { ev.title = title; ev.content = content; ev.color = selectedColor; }
            } else {
                events.push({
                    id: 'ev_' + Date.now(), dateStr: selectedDayStr,
                    startSlot: tempStartSlot, endSlot: tempEndSlot,
                    title: title, content: content, color: selectedColor
                });
            }
            saveToStorage(); resetSelectionModeState(); closeModal('modal-planner');
        }

        function openDetailPopup(ev) {
            const modal = document.getElementById('modal-detail');
            const card = document.getElementById('detail-card');
            document.getElementById('detail-title').innerText = ev.title;
            document.getElementById('detail-time').innerText = `${slotToTimeStr(ev.startSlot)} ~ ${slotToTimeStr(ev.endSlot + 1)} (${(ev.endSlot - ev.startSlot + 1) * 10}분)`;
            document.getElementById('detail-content').innerText = ev.content || "기록된 세부 내용이 없습니다.";
            card.style.borderColor = ev.color;
            modal.classList.add('active');
        }

        function openContextMenu(e, eventId) {
            activeEventId = eventId;
            const menu = document.getElementById('context-menu');
            menu.style.display = 'block'; menu.style.left = `${e.pageX}px`; menu.style.top = `${e.pageY}px`;
        }

        function handleContextAction(action) {
            const ev = events.find(e => e.id === activeEventId); if (!ev) return;
            if (action === 'adjust') {
                currentEditMode = 'adjust'; selectedDayStr = ev.dateStr; selectionStep = 0; clearTempSelectionStyles();
                const banner = document.getElementById('selection-banner');
                banner.style.display = 'block';
                banner.style.backgroundColor = '#fef3c7'; banner.style.color = '#92400e';
                banner.innerText = `🕒 [기간 조정] '${ev.title}' 항목의 새 범위를 타임라인 그리드에서 선택하세요.`;
                renderPlanner();
            } else if (action === 'edit') {
                currentEditMode = 'edit'; openPlannerModal('edit');
            } else if (action === 'delete') {
                document.getElementById('modal-delete').classList.add('active');
            }
        }

        function confirmDelete() {
            events = events.filter(e => e.id !== activeEventId);
            saveToStorage(); renderPlanner(); closeModal('modal-delete');
        }

        function addTodo(dateStr) {
            const input = document.getElementById(`input-todo-${dateStr}`); const text = input.value.trim(); if (!text) return;
            todos.push({ id: 'todo_' + Date.now(), dateStr: dateStr, text: text, completed: false });
            saveToStorage(); renderPlanner(); input.value = '';
        }
        function toggleTodo(id) { const t = todos.find(todo => todo.id === id); if (t) { t.completed = !t.completed; saveToStorage(); renderPlanner(); } }
        function deleteTodo(id) { todos = todos.filter(t => t.id !== id); saveToStorage(); renderPlanner(); }

        function exportData() {
            const dataStr = JSON.stringify({ events, todos }, null, 2);
            const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
            const link = document.createElement('a');
            link.setAttribute('href', dataUri); link.setAttribute('download', `Max_Planner_Backup.json`);
            link.click();
        }
        function triggerImport() { document.getElementById('import-file').click(); }
        function importData(e) {
            const file = e.target.files[0]; if (!file) return;
            const reader = new FileReader();
            reader.onload = function (evt) {
                try {
                    const parsed = JSON.parse(evt.target.result);
                    if (parsed) {
                        events = parsed.events || []; todos = parsed.todos || [];
                        saveToStorage(); renderPlanner(); showToast("🎉 백업 파일을 성공적으로 불러왔습니다!");
                    }
                } catch (err) { showToast("올바른 JSON 형식이 아닙니다."); }
            };
            reader.readAsText(file);
        }
        function showToast(msg) {
            const t = document.getElementById('toast');
            t.innerText = msg; t.classList.add('active');
            setTimeout(() => t.classList.remove('active'), 2500);
        }