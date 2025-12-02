/**
 * app.js
 * 核心邏輯層：負責資料處理、演算法運算、DOM 渲染與事件綁定
 */
import { GAME_CONFIG } from './game_config.js';

const CONFIG = {
    JSON_URL: 'data/lottery-data.json',
};

const App = {
    state: {
        rawData: {}, rawJackpots: {}, 
        currentGame: "", currentSubMode: null,
        currentSchool: "balance",
        filterPeriod: "", filterYear: "", filterMonth: "",
        profiles: [], user: null, db: null, apiKey: ""
    },

    init() {
        this.initFirebase();
        this.selectSchool('balance');
        this.populateYearSelect();
        this.populateMonthSelect();
        this.initFetch();
        this.bindEvents();
    },

    bindEvents() {
        const periodInput = document.getElementById('search-period');
        if (periodInput) {
            periodInput.addEventListener('input', (e) => { this.state.filterPeriod = e.target.value.trim(); this.updateDashboard(); });
        }
        document.getElementById('search-year').addEventListener('change', (e) => { this.state.filterYear = e.target.value; this.updateDashboard(); });
        document.getElementById('search-month').addEventListener('change', (e) => { this.state.filterMonth = e.target.value; this.updateDashboard(); });
    },

    async initFirebase() {
        if (typeof window.firebaseModules === 'undefined') { this.loadProfilesLocal(); return; }
        const { initializeApp, getAuth, onAuthStateChanged, getFirestore, getDoc, doc } = window.firebaseModules;
        
        const firebaseConfig = {
             apiKey: "AIzaSyBatltfrvZ5AXixdZBcruClqYrA-9ihsI0",
             authDomain: "lottery-app-bd106.firebaseapp.com",
             projectId: "lottery-app-bd106",
             storageBucket: "lottery-app-bd106.firebasestorage.app",
             messagingSenderId: "13138331714",
             appId: "1:13138331714:web:194ac3ff9513d19d9845db"
        };

        try {
            const app = initializeApp(firebaseConfig);
            const auth = getAuth(app);
            this.state.db = getFirestore(app);
            onAuthStateChanged(auth, async (user) => {
                this.state.user = user; 
                this.updateAuthUI(user);
                if (user) {
                    await this.loadProfilesCloud(user.uid);
                    const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', user.uid, 'settings', 'api');
                    const snap = await getDoc(ref);
                    if(snap.exists()) {
                        this.state.apiKey = snap.data().key;
                        document.getElementById('gemini-api-key').value = this.state.apiKey;
                    }
                } else { this.loadProfilesLocal(); }
            });
        } catch(e) { console.error(e); this.loadProfilesLocal(); }
    },
    updateAuthUI(user) {
        const loginBtn = document.getElementById('btn-login'); const userInfo = document.getElementById('user-info');
        const userName = document.getElementById('user-name'); const dot = document.getElementById('login-status-dot');
        if (user) {
            loginBtn.classList.add('hidden'); userInfo.classList.remove('hidden');
            userName.innerText = `Hi, ${user.displayName}`;
            dot.classList.remove('bg-stone-300'); dot.classList.add('bg-green-500');
        } else {
            loginBtn.classList.remove('hidden'); userInfo.classList.add('hidden');
            dot.classList.remove('bg-green-500'); dot.classList.add('bg-stone-300');
        }
    },
    async loginGoogle() { const { getAuth, signInWithPopup, GoogleAuthProvider } = window.firebaseModules; try { await signInWithPopup(getAuth(), new GoogleAuthProvider()); } catch (e) { alert("登入失敗"); } },
    async logoutGoogle() { await window.firebaseModules.signOut(window.firebaseModules.getAuth()); this.state.profiles = []; this.loadProfilesLocal(); },
    async loadProfilesCloud(uid) { const { doc, getDoc } = window.firebaseModules; const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', uid, 'profiles', 'main'); const snap = await getDoc(ref); this.state.profiles = snap.exists() ? snap.data().list || [] : []; this.renderProfileSelect(); this.renderProfileList(); },
    async saveProfilesCloud() { const { doc, setDoc } = window.firebaseModules; const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', this.state.user.uid, 'profiles', 'main'); await setDoc(ref, { list: this.state.profiles }); },
    loadProfilesLocal() { const stored = localStorage.getItem('lottery_profiles'); if (stored) this.state.profiles = JSON.parse(stored); this.renderProfileSelect(); this.renderProfileList(); },
    saveProfiles() { if (this.state.user) this.saveProfilesCloud(); localStorage.setItem('lottery_profiles', JSON.stringify(this.state.profiles)); this.renderProfileSelect(); this.renderProfileList(); },

    async saveApiKey() {
        const key = document.getElementById('gemini-api-key').value.trim();
        if(!key) return alert("請輸入 Key");
        this.state.apiKey = key;
        if (this.state.user && this.state.db) {
            const { doc, setDoc } = window.firebaseModules;
            const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', this.state.user.uid, 'settings', 'api');
            await setDoc(ref, { key: key });
            alert("API Key 已儲存至雲端");
        } else {
            localStorage.setItem('gemini_key', key);
            alert("API Key 已暫存");
        }
    },

    addProfile() {
        const name = document.getElementById('new-name').value.trim();
        const realname = document.getElementById('new-realname').value.trim();
        const ziwei = document.getElementById('new-ziwei').value.trim();
        const astro = document.getElementById('new-astro').value.trim();
        if (!name) return alert("請輸入暱稱");
        this.state.profiles.push({ id: Date.now(), name, realname, ziwei, astro });
        this.saveProfiles();
        this.toggleProfileModal();
    },
    deleteProfile(id) { if(confirm('確定刪除?')) { this.state.profiles = this.state.profiles.filter(p => p.id !== id); this.saveProfiles(); } },
    toggleProfileModal() { const modal = document.getElementById('profile-modal'); const content = document.getElementById('profile-modal-content'); if (modal.classList.contains('hidden')) { modal.classList.remove('hidden'); setTimeout(() => { content.classList.remove('scale-95', 'opacity-0'); content.classList.add('scale-100', 'opacity-100'); }, 10); } else { content.classList.remove('scale-100', 'opacity-100'); content.classList.add('scale-95', 'opacity-0'); setTimeout(() => modal.classList.add('hidden'), 200); } },
    renderProfileList() { const list = document.getElementById('profile-list'); list.innerHTML = this.state.profiles.map(p => `<div class="flex justify-between items-center bg-stone-50 p-2 rounded border border-stone-100"><div class="text-xs text-stone-700 font-bold">${p.name}</div><button onclick="app.deleteProfile(${p.id})" class="text-red-400 text-[10px]">刪除</button></div>`).join(''); },
    renderProfileSelect() { const sel = document.getElementById('profile-select'); sel.innerHTML = '<option value="">請新增...</option>' + this.state.profiles.map(p => `<option value="${p.id}">${p.name}</option>`).join(''); },
    deleteCurrentProfile() { const pid = document.getElementById('profile-select').value; if(pid && confirm('確定刪除?')) { this.deleteProfile(Number(pid)); document.getElementById('profile-select').value = ""; this.onProfileChange(); } },

    async generateAIFortune() {
        const pid = document.getElementById('profile-select').value;
        if (!pid) return alert("請先選擇主角");
        if (!this.state.apiKey) return alert("請設定 Key");
        const profile = this.state.profiles.find(p => p.id == pid);
        document.getElementById('ai-loading').classList.remove('hidden');
        document.getElementById('btn-calc-ai').disabled = true;

        const prompt = `你是一位命理宗師。命主：${profile.name} (${profile.realname})。${profile.ziwei} ${profile.astro}。請分析2025流年運勢。回傳JSON：{"year_analysis":"100字運勢分析","monthly_elements":[{"month":1,"lucky_tails":[2,7],"lucky_elements":["火"]},...]}`;
        try {
            const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${this.state.apiKey}`;
            const response = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }) });
            const data = await response.json();
            const text = data.candidates[0].content.parts[0].text.replace(/```json|```/g, '').trim();
            profile.fortune2025 = JSON.parse(text);
            this.saveProfiles();
            this.onProfileChange();
        } catch (e) { console.error(e); alert("AI 運算失敗"); } 
        finally { document.getElementById('ai-loading').classList.add('hidden'); document.getElementById('btn-calc-ai').disabled = false; }
    },
    onProfileChange() {
        const pid = document.getElementById('profile-select').value;
        const aiSection = document.getElementById('ai-fortune-section');
        const display = document.getElementById('ai-result-display');
        const btn = document.getElementById('btn-calc-ai');
        const btnClear = document.getElementById('btn-clear-ai');
        if (!pid) { aiSection.classList.add('hidden'); return; }
        aiSection.classList.remove('hidden');
        const profile = this.state.profiles.find(p => p.id == pid);
        if (profile && profile.fortune2025) {
            display.classList.remove('hidden');
            display.innerHTML = `<div class="font-bold text-stone-800 mb-1">📅 2025 流年：</div><p>${profile.fortune2025.year_analysis}</p>`;
            btn.innerText = "🔄 重新批算"; btnClear.classList.remove('hidden');
        } else {
            display.classList.add('hidden'); btn.innerText = "✨ 大師批流年"; btnClear.classList.add('hidden');
        }
    },
    clearFortune() {
        const pid = document.getElementById('profile-select').value;
        const profile = this.state.profiles.find(p => p.id == pid);
        if(profile && confirm('清除流年?')) { delete profile.fortune2025; this.saveProfiles(); this.onProfileChange(); }
    },

    async initFetch() {
        try {
            const response = await fetch(`${CONFIG.JSON_URL}?t=${new Date().getTime()}`);
            if (!response.ok) throw new Error("Data Error");
            const fullData = await response.json();
            this.state.rawData = fullData.games || fullData;
            this.state.rawJackpots = fullData.jackpots || {};
            for (let game in this.state.rawData) { this.state.rawData[game] = this.state.rawData[game].map(item => ({...item, date: new Date(item.date)})); }
            document.getElementById('system-status-text').innerText = "系統連線正常";
            document.getElementById('system-status-text').className = "text-green-600";
            document.getElementById('system-status-icon').className = "w-2 h-2 rounded-full bg-green-500";
            if(fullData.last_updated) document.getElementById('last-update-time').innerText = fullData.last_updated.split(' ')[0];
            this.renderGameButtons();
        } catch(e) {
            console.error(e);
            document.getElementById('system-status-text').innerText = "離線模式";
            this.renderGameButtons();
        }
    },

    renderGameButtons() {
        const container = document.getElementById('game-btn-container');
        container.innerHTML = '';
        GAME_CONFIG.ORDER.forEach(gameName => {
            const btn = document.createElement('div');
            btn.className = `game-tab-btn ${gameName === this.state.currentGame ? 'active' : ''}`;
            btn.innerText = gameName; 
            btn.onclick = () => {
                this.state.currentGame = gameName;
                this.state.currentSubMode = null;
                this.resetFilter();
                document.querySelectorAll('.game-tab-btn').forEach(el => el.classList.remove('active'));
                btn.classList.add('active');
                this.updateDashboard();
            };
            container.appendChild(btn);
        });
        if (!this.state.currentGame && GAME_CONFIG.ORDER.length > 0) {
            this.state.currentGame = GAME_CONFIG.ORDER[0];
            container.querySelector('.game-tab-btn')?.classList.add('active');
            this.updateDashboard();
        }
    },

    updateDashboard() {
        const gameName = this.state.currentGame;
        const gameDef = GAME_CONFIG.GAMES[gameName];
        let data = this.state.rawData[gameName] || [];
        if (this.state.filterPeriod) data = data.filter(item => String(item.period).includes(this.state.filterPeriod));
        if (this.state.filterYear) data = data.filter(item => item.date.getFullYear() === parseInt(this.state.filterYear));
        if (this.state.filterMonth) data = data.filter(item => (item.date.getMonth() + 1) === parseInt(this.state.filterMonth));

        document.getElementById('current-game-title').innerText = gameName;
        document.getElementById('total-count').innerText = data.length;
        document.getElementById('latest-period').innerText = data.length > 0 ? `${data[0].period}期` : "--期";
        
        const jackpotContainer = document.getElementById('jackpot-container');
        if (this.state.rawJackpots[gameName] && !this.state.filterPeriod) {
            jackpotContainer.classList.remove('hidden');
            document.getElementById('jackpot-amount').innerText = `$${this.state.rawJackpots[gameName]}`;
        } else { jackpotContainer.classList.add('hidden'); }

        this.renderSubModeUI(gameDef);
        this.renderHotStats('stat-year', data);
        this.renderHotStats('stat-month', data.slice(0, 30));
        this.renderHotStats('stat-recent', data.slice(0, 10));
        
        document.getElementById('no-result-msg').classList.toggle('hidden', data.length > 0);
        this.renderHistoryList(data.slice(0, 5));
    },

    renderSubModeUI(gameDef) {
        const area = document.getElementById('submode-area');
        const container = document.getElementById('submode-tabs');
        const rulesContent = document.getElementById('game-rules-content');
        rulesContent.classList.add('hidden');
        if (gameDef.subModes) {
            area.classList.remove('hidden');
            container.innerHTML = '';
            if (!this.state.currentSubMode) this.state.currentSubMode = gameDef.subModes[0].id;
            gameDef.subModes.forEach(mode => {
                const tab = document.createElement('div');
                tab.className = `submode-tab ${this.state.currentSubMode === mode.id ? 'active' : ''}`;
                tab.innerText = mode.name;
                tab.onclick = () => {
                    this.state.currentSubMode = mode.id;
                    document.querySelectorAll('.submode-tab').forEach(t => t.classList.remove('active'));
                    tab.classList.add('active');
                };
                container.appendChild(tab);
            });
            rulesContent.innerHTML = gameDef.article || "暫無說明";
        } else { area.classList.add('hidden'); this.state.currentSubMode = null; }
    },
    toggleRules() { document.getElementById('game-rules-content').classList.toggle('hidden'); },

    renderHistoryList(data) {
        const list = document.getElementById('history-list');
        list.innerHTML = '';
        data.forEach(item => {
            let numsHtml = "";
            const gameType = GAME_CONFIG.GAMES[this.state.currentGame].type;
            if (gameType === 'digit') {
                numsHtml = item.numbers.map(n => `<span class="ball-sm">${n}</span>`).join('');
            } else {
                const special = item.numbers[item.numbers.length - 1];
                const normal = item.numbers.slice(0, item.numbers.length - 1);
                numsHtml = normal.map(n => `<span class="ball-sm">${n}</span>`).join('');
                if (GAME_CONFIG.GAMES[this.state.currentGame].special) numsHtml += `<span class="ball-sm ball-special ml-2 font-black border-none">${special}</span>`;
            }
            list.innerHTML += `<tr class="table-row"><td class="px-5 py-3 border-b border-stone-100"><div class="font-bold text-stone-700">No. ${item.period}</div><div class="text-[10px] text-stone-400">${item.date.toLocaleDateString()}</div></td><td class="px-5 py-3 border-b border-stone-100 flex flex-wrap gap-1">${numsHtml}</td></tr>`;
        });
    },
    renderHotStats(elId, dataset) {
        const el = document.getElementById(elId);
        if (!dataset || dataset.length === 0) { el.innerHTML = '<span class="text-stone-300 text-[10px]">無數據</span>'; return; }
        const freq = {}; dataset.forEach(d => d.numbers.forEach(n => freq[n] = (freq[n]||0)+1));
        const sorted = Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 5);
        // 修改3：統計次數加大至 text-sm (14px) 並加粗
        el.innerHTML = sorted.map(([n, c]) => `<div class="flex flex-col items-center"><div class="ball ball-hot mb-1 scale-75">${n}</div><div class="text-sm text-stone-600 font-black">${c}</div></div>`).join('');
    },

    selectSchool(school) {
        this.state.currentSchool = school;
        const info = GAME_CONFIG.SCHOOLS[school];
        
        document.querySelectorAll('.school-card').forEach(el => {
            el.classList.remove('active');
            Object.values(GAME_CONFIG.SCHOOLS).forEach(s => {
                if(s.color) el.classList.remove(s.color);
            });
        });
        
        const activeCard = document.querySelector(`.school-${school}`);
        if(activeCard) {
            activeCard.classList.add('active');
            activeCard.classList.add(info.color);
        }
        
        const container = document.getElementById('school-description');
        container.className = `text-sm leading-relaxed text-stone-600 bg-stone-50 p-5 rounded-xl border-l-4 ${info.color}`;
        container.innerHTML = `<h4 class="text-base font-bold mb-3 text-stone-800">${info.title}</h4>${info.desc}`;
        document.getElementById('wuxing-options').classList.toggle('hidden', school !== 'wuxing');
    },

    runPrediction() {
        const gameName = this.state.currentGame;
        const gameDef = GAME_CONFIG.GAMES[gameName];
        let data = this.state.rawData[gameName] || [];
        if(!gameDef) return;
        const count = parseInt(document.querySelector('input[name="count"]:checked').value);
        const container = document.getElementById('prediction-output');
        container.innerHTML = '';
        document.getElementById('result-area').classList.remove('hidden');

        const isDigitGame = gameDef.type === 'digit';
        let pickCount = gameDef.count;
        let subModeId = this.state.currentSubMode;
        if (isDigitGame && subModeId) {
            const modeConfig = gameDef.subModes.find(m => m.id === subModeId);
            if (modeConfig) pickCount = modeConfig.count;
        }

        for(let i=0; i<count; i++) {
            let result = null;
            const params = { data, range: gameDef.range, pickCount, isDigitGame, subModeId };
            switch(this.state.currentSchool) {
                case 'stat': result = this.algoStat(params); break;
                case 'pattern': result = this.algoPattern(params); break;
                case 'balance': result = this.algoBalance(params); break;
                case 'ai': result = this.algoAI(params); break;
                case 'wuxing': result = this.algoWuxing(params); break;
            }
            if (result) this.renderRow(result, i+1);
        }
    },

    algoStat({ data, range, pickCount, isDigitGame }) {
        const freq = {}; data.forEach(d => d.numbers.forEach(n => freq[n] = (freq[n]||0)+1));
        const weights = {}; const maxNum = isDigitGame ? 9 : range; const minNum = isDigitGame ? 0 : 1;
        for(let i=minNum; i<=maxNum; i++) weights[i] = (freq[i] || 1) + Math.random() * 5;
        const selected = this.weightedSelect(weights, pickCount, isDigitGame, minNum, maxNum);
        return { numbers: selected.map(n => ({ val: n, tag: '熱號' })), groupReason: "數據慣性" };
    },
    algoPattern({ data, range, pickCount, isDigitGame }) {
        if(data.length < 2) return this.algoStat({data, range, pickCount, isDigitGame});
        const lastDraw = data[0].numbers; const weights = {}; const maxNum = isDigitGame ? 9 : range; const minNum = isDigitGame ? 0 : 1;
        for(let i=minNum; i<=maxNum; i++) weights[i] = 10;
        lastDraw.forEach(n => { if(weights[n]) weights[n] += 20; if(weights[n+1]) weights[n+1] += 10; if(weights[n-1]) weights[n-1] += 10; });
        const selected = this.weightedSelect(weights, pickCount, isDigitGame, minNum, maxNum);
        return { numbers: selected.map(n => ({ val: n, tag: lastDraw.includes(n)?'連莊':'鄰號' })), groupReason: "版路拖牌" };
    },
    algoBalance({ range, pickCount, isDigitGame }) {
        const selected = []; const maxNum = isDigitGame ? 9 : range; const minNum = isDigitGame ? 0 : 1;
        while(selected.length < pickCount) {
            const n = Math.floor(Math.random() * (maxNum - minNum + 1)) + minNum;
            if (isDigitGame) selected.push(n); else if (!selected.includes(n)) selected.push(n);
        }
        if(!isDigitGame) selected.sort((a,b)=>a-b);
        return { numbers: selected.map(n => ({ val: n, tag: n%2==0?'偶':'奇' })), groupReason: "結構平衡" };
    },
    algoAI({ data, range, pickCount, isDigitGame }) {
        const weights = {}; const maxNum = isDigitGame ? 9 : range; const minNum = isDigitGame ? 0 : 1;
        data.slice(0, 20).forEach((d, idx) => { const w = 50 - idx; d.numbers.forEach(n => weights[n] = (weights[n]||0) + w); });
        for(let i=minNum; i<=maxNum; i++) if(!weights[i]) weights[i] = 5;
        const selected = this.weightedSelect(weights, pickCount, isDigitGame, minNum, maxNum);
        return { numbers: selected.map(n => ({ val: n, tag: 'AI' })), groupReason: "趨勢加權" };
    },
    algoWuxing({ range, pickCount, isDigitGame }) {
        const maxNum = isDigitGame ? 9 : range; const minNum = isDigitGame ? 0 : 1; const weights = {};
        for(let i=minNum; i<=maxNum; i++) weights[i] = Math.random() * 100;
        const pid = document.getElementById('profile-select').value; const profile = this.state.profiles.find(p => p.id == pid);
        let reason = "隨機運勢";
        if(profile && profile.fortune2025) {
            const mData = profile.fortune2025.monthly_elements?.[0];
            if(mData && mData.lucky_tails) { mData.lucky_tails.forEach(t => { for(let i=minNum; i<=maxNum; i++) if (i % 10 === t) weights[i] += 50; }); reason = "流年尾數加持"; }
        }
        const selected = this.weightedSelect(weights, pickCount, isDigitGame, minNum, maxNum);
        return { numbers: selected.map(n => ({ val: n, tag: '吉' })), groupReason: reason };
    },
    weightedSelect(weights, count, allowRepeat, min, max) {
        const result = []; const pool = [];
        for(let i=min; i<=max; i++) { const w = Math.floor(weights[i] || 1); for(let k=0; k<w; k++) pool.push(i); }
        for(let i=0; i<count; i++) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length); const val = pool[idx]; result.push(val);
            if (!allowRepeat) { const newPool = pool.filter(n => n !== val); pool.length = 0; pool.push(...newPool); }
        }
        if(!allowRepeat) result.sort((a,b)=>a-b);
        return result;
    },

    renderRow(resultObj, index) {
        const container = document.getElementById('prediction-output');
        const colors = { stat: 'bg-stone-200 text-stone-700', pattern: 'bg-purple-100 text-purple-700', balance: 'bg-emerald-100 text-emerald-800', ai: 'bg-amber-100 text-amber-800', wuxing: 'bg-pink-100 text-pink-800' };
        const colorClass = colors[this.state.currentSchool];
        let html = `<div class="flex flex-col gap-2 p-4 bg-white rounded-xl border border-stone-200 shadow-sm animate-fade-in hover:shadow-md transition"><div class="flex items-center gap-3"><span class="text-[10px] font-black text-stone-300 tracking-widest">SET ${index}</span><div class="flex flex-wrap gap-2">`;
        
        resultObj.numbers.forEach(item => { 
            html += `<div class="flex flex-col items-center"><div class="ball-sm ${colorClass}" style="box-shadow: none;">${item.val}</div>${item.tag ? `<div class="reason-tag">${item.tag}</div>` : ''}</div>`; 
        });
        
        html += `</div></div>`;
        if (resultObj.groupReason) { html += `<div class="text-[10px] text-stone-500 font-medium bg-stone-50 px-2 py-1.5 rounded border border-stone-100 flex items-center gap-1"><span class="text-sm">💡</span> ${resultObj.groupReason}</div>`; }
        html += `</div>`;
        container.innerHTML += html;
    },
    populateYearSelect() { const yearSelect = document.getElementById('search-year'); for (let y = 2021; y <= 2026; y++) { const opt = document.createElement('option'); opt.value = y; opt.innerText = `${y}`; yearSelect.appendChild(opt); } },
    populateMonthSelect() { const monthSelect = document.getElementById('search-month'); for (let m = 1; m <= 12; m++) { const opt = document.createElement('option'); opt.value = m; opt.innerText = `${m} 月`; monthSelect.appendChild(opt); } },
    resetFilter() { 
        this.state.filterPeriod = ""; 
        this.state.filterYear = ""; 
        this.state.filterMonth = ""; 
        const pInput = document.getElementById('search-period'); if(pInput) pInput.value = "";
        document.getElementById('search-year').value = ""; 
        document.getElementById('search-month').value = ""; 
        this.updateDashboard(); 
    },
    toggleHistory() {
        const c = document.getElementById('history-container');
        const a = document.getElementById('history-arrow');
        const t = document.getElementById('history-toggle-text');
        
        if (c.classList.contains('max-h-0')) {
            c.classList.remove('max-h-0');
            c.classList.add('max-h-[1000px]');
            a.classList.add('rotate-180');
            t.innerText = "隱藏近 5 期";
        } else {
            c.classList.add('max-h-0');
            c.classList.remove('max-h-[1000px]');
            a.classList.remove('rotate-180');
            t.innerText = "顯示近 5 期";
        }
    },
};

window.app = App;
window.onload = () => App.init();
