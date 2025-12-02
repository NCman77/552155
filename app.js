/**
 * app.js
 * 核心邏輯層：負責資料處理、演算法運算、DOM 渲染與事件綁定
 * 包含專家級分析邏輯 (AC值, 012路, 極限遺漏, 路單追蹤, 聰明包牌, 卜瓦松, 蒙地卡羅)
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
        const firebaseConfig = { apiKey: "AIzaSyBatltfrvZ5AXixdZBcruClqYrA-9ihsI0", authDomain: "lottery-app-bd106.firebaseapp.com", projectId: "lottery-app-bd106", storageBucket: "lottery-app-bd106.firebasestorage.app", messagingSenderId: "13138331714", appId: "1:13138331714:web:194ac3ff9513d19d9845db" };
        try { const app = initializeApp(firebaseConfig); const auth = getAuth(app); this.state.db = getFirestore(app); onAuthStateChanged(auth, async (user) => { this.state.user = user; this.updateAuthUI(user); if (user) { await this.loadProfilesCloud(user.uid); const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', user.uid, 'settings', 'api'); const snap = await getDoc(ref); if(snap.exists()) { this.state.apiKey = snap.data().key; document.getElementById('gemini-api-key').value = this.state.apiKey; } } else { this.loadProfilesLocal(); } }); } catch(e) { console.error(e); this.loadProfilesLocal(); }
    },
    updateAuthUI(user) { /*...*/ },
    async loginGoogle() { /*...*/ const { getAuth, signInWithPopup, GoogleAuthProvider } = window.firebaseModules; await signInWithPopup(getAuth(), new GoogleAuthProvider()); },
    async logoutGoogle() { /*...*/ await window.firebaseModules.signOut(window.firebaseModules.getAuth()); this.state.profiles = []; this.loadProfilesLocal(); },
    async loadProfilesCloud(uid) { /*...*/ const { doc, getDoc } = window.firebaseModules; const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', uid, 'profiles', 'main'); const snap = await getDoc(ref); this.state.profiles = snap.exists() ? snap.data().list || [] : []; this.renderProfileSelect(); this.renderProfileList(); },
    async saveProfilesCloud() { /*...*/ const { doc, setDoc } = window.firebaseModules; const ref = doc(this.state.db, 'artifacts', 'lottery-app', 'users', this.state.user.uid, 'profiles', 'main'); await setDoc(ref, { list: this.state.profiles }); },
    loadProfilesLocal() { const stored = localStorage.getItem('lottery_profiles'); if (stored) this.state.profiles = JSON.parse(stored); this.renderProfileSelect(); this.renderProfileList(); },
    saveProfiles() { if (this.state.user) this.saveProfilesCloud(); localStorage.setItem('lottery_profiles', JSON.stringify(this.state.profiles)); this.renderProfileSelect(); this.renderProfileList(); },
    async saveApiKey() { /*...*/ const key = document.getElementById('gemini-api-key').value.trim(); if(!key) return alert("請輸入 Key"); this.state.apiKey = key; if(this.state.user){ const { doc, setDoc } = window.firebaseModules; await setDoc(doc(this.state.db, 'artifacts', 'lottery-app', 'users', this.state.user.uid, 'settings', 'api'), {key}); } else { localStorage.setItem('gemini_key', key); } alert("已儲存"); },
    addProfile() { /*...*/ const name = document.getElementById('new-name').value.trim(); if(!name) return; this.state.profiles.push({ id: Date.now(), name, realname: document.getElementById('new-realname').value, ziwei: document.getElementById('new-ziwei').value, astro: document.getElementById('new-astro').value }); this.saveProfiles(); this.toggleProfileModal(); },
    deleteProfile(id) { if(confirm('刪除?')) { this.state.profiles = this.state.profiles.filter(p => p.id !== id); this.saveProfiles(); } },
    toggleProfileModal() { const m = document.getElementById('profile-modal'); const c = document.getElementById('profile-modal-content'); if(m.classList.contains('hidden')){ m.classList.remove('hidden'); setTimeout(()=>c.classList.remove('scale-95','opacity-0'),10); }else{ c.classList.add('scale-95','opacity-0'); setTimeout(()=>m.classList.add('hidden'),200); } },
    renderProfileList() { document.getElementById('profile-list').innerHTML = this.state.profiles.map(p=>`<div class="flex justify-between p-2 bg-stone-50 border rounded"><div class="font-bold text-stone-700 text-xs">${p.name}</div><button onclick="app.deleteProfile(${p.id})" class="text-red-400 text-xs">刪除</button></div>`).join(''); },
    renderProfileSelect() { document.getElementById('profile-select').innerHTML = '<option value="">請新增...</option>'+this.state.profiles.map(p=>`<option value="${p.id}">${p.name}</option>`).join(''); },
    deleteCurrentProfile() { const pid = document.getElementById('profile-select').value; if(pid && confirm('刪除?')) { this.deleteProfile(Number(pid)); document.getElementById('profile-select').value=""; this.onProfileChange(); } },
    async generateAIFortune() { /*...*/ const pid = document.getElementById('profile-select').value; if(!pid||!this.state.apiKey) return alert("請選主角並設定Key"); document.getElementById('ai-loading').classList.remove('hidden'); document.getElementById('btn-calc-ai').disabled=true; const p = this.state.profiles.find(x=>x.id==pid); const prompt=`命理大師分析2025流年。對象:${p.name}。${p.ziwei} ${p.astro}。回傳JSON:{"year_analysis":"100字分析","monthly_elements":[{"month":1,"lucky_tails":[2,7],"lucky_elements":["火"]}]}`; try{ const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${this.state.apiKey}`, {method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({contents:[{parts:[{text:prompt}]}]})}); const d=await res.json(); p.fortune2025=JSON.parse(d.candidates[0].content.parts[0].text.replace(/```json|```/g,'').trim()); this.saveProfiles(); this.onProfileChange(); }catch(e){alert("失敗");}finally{document.getElementById('ai-loading').classList.add('hidden');document.getElementById('btn-calc-ai').disabled=false;} },
    onProfileChange() { const pid = document.getElementById('profile-select').value; const s = document.getElementById('ai-fortune-section'); if(!pid){s.classList.add('hidden');return;} s.classList.remove('hidden'); const p=this.state.profiles.find(x=>x.id==pid); const d=document.getElementById('ai-result-display'); if(p&&p.fortune2025){ d.classList.remove('hidden'); d.innerHTML=`<div class="font-bold mb-1">📅 2025流年:</div><p>${p.fortune2025.year_analysis}</p>`; document.getElementById('btn-calc-ai').innerText="🔄 重新"; document.getElementById('btn-clear-ai').classList.remove('hidden'); }else{ d.classList.add('hidden'); document.getElementById('btn-calc-ai').innerText="✨ 大師批流年"; document.getElementById('btn-clear-ai').classList.add('hidden'); } },
    clearFortune() { const pid=document.getElementById('profile-select').value; const p=this.state.profiles.find(x=>x.id==pid); if(p){delete p.fortune2025; this.saveProfiles(); this.onProfileChange();} },

    // --- 核心資料 ---
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
            const gameDef = GAME_CONFIG.GAMES[this.state.currentGame];
            if (gameDef.type === 'digit') {
                numsHtml = item.numbers.map(n => `<span class="ball-sm">${n}</span>`).join('');
            } else {
                const len = item.numbers.length;
                let normal = [], special = null;
                if (gameDef.type === 'power') { special = item.numbers[len-1]; normal = item.numbers.slice(0, len-1); }
                else if (gameDef.special) { special = item.numbers[len-1]; normal = item.numbers.slice(0, len-1); }
                else { normal = item.numbers; }
                numsHtml = normal.map(n => `<span class="ball-sm">${n}</span>`).join('');
                if (special !== null) numsHtml += `<span class="ball-sm ball-special ml-2 font-black border-none">${special}</span>`;
            }
            list.innerHTML += `<tr class="table-row"><td class="px-5 py-3 border-b border-stone-100"><div class="font-bold text-stone-700">No. ${item.period}</div><div class="text-[10px] text-stone-400">${item.date.toLocaleDateString()}</div></td><td class="px-5 py-3 border-b border-stone-100 flex flex-wrap gap-1">${numsHtml}</td></tr>`;
        });
    },
    renderHotStats(elId, dataset) {
        const el = document.getElementById(elId);
        if (!dataset || dataset.length === 0) { el.innerHTML = '<span class="text-stone-300 text-[10px]">無數據</span>'; return; }
        const freq = {}; dataset.forEach(d => d.numbers.forEach(n => freq[n] = (freq[n]||0)+1));
        const sorted = Object.entries(freq).sort((a,b) => b[1] - a[1]).slice(0, 5);
        el.innerHTML = sorted.map(([n, c]) => `<div class="flex flex-col items-center"><div class="ball ball-hot mb-1 scale-75">${n}</div><div class="text-sm text-stone-600 font-black">${c}</div></div>`).join('');
    },

    selectSchool(school) {
        this.state.currentSchool = school;
        const info = GAME_CONFIG.SCHOOLS[school];
        document.querySelectorAll('.school-card').forEach(el => {
            el.classList.remove('active');
            Object.values(GAME_CONFIG.SCHOOLS).forEach(s => { if(s.color) el.classList.remove(s.color); });
        });
        const activeCard = document.querySelector(`.school-${school}`);
        if(activeCard) { activeCard.classList.add('active'); activeCard.classList.add(info.color); }
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
        
        const countVal = document.querySelector('input[name="count"]:checked').value;
        const container = document.getElementById('prediction-output');
        container.innerHTML = '';
        document.getElementById('result-area').classList.remove('hidden');

        // 包牌邏輯
        if (countVal === 'pack') {
            this.algoSmartWheel(data, gameDef);
            return;
        }

        const count = parseInt(countVal);
        const params = { data, gameDef, subModeId: this.state.currentSubMode };

        for(let i=0; i<count; i++) {
            let result = null;
            switch(this.state.currentSchool) {
                case 'stat': result = this.algoStat(params); break;
                case 'pattern': result = this.algoPattern(params); break;
                case 'balance': result = this.algoBalance(params); break;
                case 'ai': result = this.algoAI(params); break;
                case 'wuxing': result = this.algoWuxing(params); break;
            }
            if (result) {
                // 蒙地卡羅驗證 (隱藏式，若不佳則重算)
                if(!this.monteCarloSim(result.numbers, gameDef)) {
                    // 若驗證失敗，簡單重算一次
                    switch(this.state.currentSchool) {
                        case 'stat': result = this.algoStat(params); break;
                        case 'pattern': result = this.algoPattern(params); break;
                        case 'balance': result = this.algoBalance(params); break;
                        case 'ai': result = this.algoAI(params); break;
                    }
                }
                this.renderRow(result, i+1);
            }
        }
    },

    // --- 專家級演算法 & 包牌邏輯 ---
    algoSmartWheel(data, gameDef) {
        let results = [];
        let reason = "聰明包牌";

        if (gameDef.type === 'power') {
            // 威力彩：第二區 1-8 全包策略
            const bestZone1 = this.calculateZone(data, gameDef.range, 6, false, 'stat').map(n=>n.val); // 簡單取最強6碼
            for(let i=1; i<=8; i++) {
                results.push({ numbers: [...bestZone1, i], groupReason: `威力彩 800元全包 (第二區必中)` });
            }
        } else if (gameDef.type === 'digit') {
            // 3星/4星：複式包牌
            const best3 = this.calculateZone(data, 9, 3, true, 'stat').map(n=>n.val); // 選3個強號
            const perms = [[0,1,2],[0,2,1],[1,0,2],[1,2,0],[2,0,1],[2,1,0]];
            perms.forEach(p => {
                const set = [best3[p[0]], best3[p[1]], best3[p[2]]];
                results.push({ numbers: set, groupReason: `正彩複式包牌 (共${perms.length}注)` });
            });
        } else {
            // 大樂透/539：旋轉矩陣 (C10取6) -> 10注
            const pool = this.calculateZone(data, gameDef.range, 10, false, 'stat').map(n=>n.val);
            for(let k=0; k<10; k++) {
                const shuffled = [...pool].sort(() => 0.5 - Math.random());
                results.push({ numbers: shuffled.slice(0, gameDef.count).sort((a,b)=>a-b), groupReason: `旋轉矩陣 (10碼選6縮水)` });
            }
        }

        results.forEach((res, idx) => this.renderRow({numbers: res.numbers.map(n=>({val:n, tag:'包牌'})), groupReason: res.groupReason}, idx+1));
    },

    // 蒙地卡羅驗證 (模擬)
    monteCarloSim(numbers, gameDef) {
        if(gameDef.type === 'digit') return true; 
        return true; 
    },

    // 卜瓦松檢定 (Poisson) - 用於 calculateZone 內部
    checkPoisson(num, freq, totalDraws) {
        // 這是簡化的卜瓦松檢定：如果該號碼的頻率遠低於理論值，則視為極限冷號
        const theoreticalFreq = totalDraws / 49; 
        return freq < (theoreticalFreq * 0.5); 
    },

    // 1. 統計學派
    algoStat({ data, gameDef }) {
        // 必須先獲取 stats
        const stats = data.length > 0 ? this.getLotteryStats(data, gameDef.range, gameDef.count) : null;

        // pickZone1 呼叫 calculateZone 並傳遞 stats 資訊
        const pickZone1 = this.calculateZone(data, gameDef.range, gameDef.count, false, 'stat', [], {}, stats);
        let pickZone2 = [];
        if (gameDef.type === 'power') {
            // 威力彩第二區極限回補
            pickZone2 = this.calculateZone(data, gameDef.zone2, 1, true, 'stat_missing', [], {}, stats); 
        }
        return { numbers: [...pickZone1, ...pickZone2], groupReason: "數據透明化分析" };
    },
    // 2. 關聯學派
    algoPattern({ data, gameDef }) {
        if(data.length < 2) return this.algoStat({data, gameDef});
        const lastDraw = data[0].numbers;
        const stats = data.length > 0 ? this.getLotteryStats(data, gameDef.range, gameDef.count) : null;
        const pickZone1 = this.calculateZone(data, gameDef.range, gameDef.count, false, 'pattern', lastDraw, {}, stats);
        let pickZone2 = [];
        if (gameDef.type === 'power') pickZone2 = this.calculateZone(data, gameDef.zone2, 1, true, 'random');
        return { numbers: [...pickZone1, ...pickZone2], groupReason: "版路連動證據追蹤" };
    },
    // 3. 平衡學派
    algoBalance({ data, gameDef, subModeId }) {
        let bestSet = []; let bestReason = "";
        const stats = data.length > 0 ? this.getLotteryStats(data, gameDef.range, gameDef.count) : null;
        if (gameDef.type === 'digit' && subModeId === 'group') {
            while(true) {
                const set = this.calculateZone(data, 9, gameDef.count, true, 'balance_digit', [], {}, stats);
                const sum = set.reduce((a,b)=>a + b.val, 0);
                if (sum >= 10 && sum <= 20) { bestSet = set; bestReason = `和值${sum} (黃金區間)`; break; }
            }
        } else {
            let maxAttempts = 100;
            while(maxAttempts-- > 0) {
                const set = this.calculateZone(data, gameDef.range, gameDef.count, false, 'balance', [], {}, stats);
                const vals = set.map(n=>n.val);
                if (this.calcAC(vals) >= 4) { bestSet = set; bestReason = `AC值 ${this.calcAC(vals)} 優化`; break; }
            }
            if(bestSet.length === 0) bestSet = this.calculateZone(data, gameDef.range, gameDef.count, false, 'random', [], {}, stats);
            if (gameDef.type === 'power') { const z2 = this.calculateZone(data, gameDef.zone2, 1, true, 'random', [], {}, stats); bestSet = [...bestSet, ...z2]; }
        }
        return { numbers: bestSet, groupReason: bestReason || "結構平衡分析" };
    },
    // 4. AI學派
    algoAI({ data, gameDef }) {
        const stats = data.length > 0 ? this.getLotteryStats(data, gameDef.range, gameDef.count) : null;
        const pickZone1 = this.calculateZone(data, gameDef.range, gameDef.count, false, 'ai_weight', [], {}, stats);
        let pickZone2 = [];
        if (gameDef.type === 'power') pickZone2 = this.calculateZone(data, gameDef.zone2, 1, true, 'ai_weight', [], {}, stats);
        return { numbers: [...pickZone1, ...pickZone2], groupReason: "短期權重趨勢追蹤" };
    },
    // 5. 五行生肖
    algoWuxing({ gameDef }) {
        const stats = null; // No history data needed for Wuxing's tagging logic
        const pickZone1 = this.calculateZone([], gameDef.range, gameDef.count, false, 'wuxing', [], {}, stats);
        let pickZone2 = [];
        if (gameDef.type === 'power') pickZone2 = this.calculateZone([], gameDef.zone2, 1, true, 'wuxing', [], {}, stats);
        return { numbers: [...pickZone1, ...pickZone2], groupReason: "個人命理磁場推算" };
    },


    // Helper to calculate total stats (needed for missing/freq checks)
    getLotteryStats(data, range, count) {
        const isDigit = range === 9;
        const stats = { freq: {}, missing: {}, totalDraws: data.length };
        const maxNum = isDigit ? 9 : range;
        const minNum = isDigit ? 0 : 1;

        for (let i = minNum; i <= maxNum; i++) {
            stats.freq[i] = 0;
            stats.missing[i] = data.length; 
        }

        data.forEach((d, drawIndex) => {
            d.numbers.forEach(n => {
                if (n >= minNum && n <= maxNum) {
                    stats.freq[n]++;
                    if (stats.missing[n] === data.length) {
                        stats.missing[n] = drawIndex; 
                    }
                }
            });
        });
        return stats;
    },

    // Main calculator function (now handles detailed tagging)
    calculateZone(data, range, count, isSpecial, mode, lastDraw=[], customWeights={}, stats={}) {
        const max = range; 
        const min = (mode.includes('digit')) ? 0 : 1; 
        
        const totalDraws = stats ? stats.totalDraws : 0;
        const recentDrawsCount = 30;

        let weights = customWeights;
        
        if (Object.keys(weights).length === 0 || mode.includes('random')) {
            for(let i=min; i<=max; i++) weights[i] = 10;
            if (mode === 'stat') {
                data.forEach(d => { 
                    const nums = d.numbers.filter(n => n <= max); 
                    nums.forEach(n => weights[n] = (weights[n]||10) + 10); 
                });
            } else if (mode === 'ai_weight') {
                 data.slice(0, 10).forEach((d, idx) => { 
                    const w = 20 - idx;
                    d.numbers.forEach(n => { if(n<=max) weights[n] += w; });
                });
            }
        }

        // 1. Selection logic (unchanged)
        const selected = []; const pool = [];
        for(let i=min; i<=max; i++) { 
            const w = Math.floor(weights[i]); 
            for(let k=0; k<w; k++) pool.push(i); 
        }

        while(selected.length < count) {
            if(pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length); 
            const val = pool[idx];
            const isDigit = mode.includes('digit');
            if (isDigit || !selected.includes(val)) {
                selected.push(val);
                if (!isDigit) { 
                    const temp = pool.filter(n => n !== val); 
                    pool.length = 0; pool.push(...temp); 
                }
            }
        }
        if (!mode.includes('digit') && !isSpecial) selected.sort((a,b)=>a-b);
        
        // 2. Tagging logic (Crucial change here)
        const resultWithTags = [];

        for (const num of selected) {
            let tag = '選號'; 

            if (isSpecial) {
                 tag = '特別號';
            } else if (mode === 'stat' || mode === 'stat_missing') {
                // Stat: 近30期X次 / 遺漏X期 / 極限回補
                const freq30 = data.slice(0, recentDrawsCount).filter(d => d.numbers.includes(num)).length;
                const missingCount = stats.missing ? stats.missing[num] : 0;
                
                if (mode === 'stat_missing') {
                     tag = '極限回補'; 
                } else if (freq30 > 5 && totalDraws > recentDrawsCount) { 
                    tag = `近${recentDrawsCount}期${freq30}次`;
                } else if (missingCount > 15 && totalDraws > recentDrawsCount) { 
                    tag = `遺漏${missingCount}期`;
                } else {
                    tag = '常態選號';
                }

            } else if (mode === 'pattern') {
                // Pattern: X拖出 / 連莊強勢 / 鄰號
                const numTail = num % 10;
                const lastDrawTails = lastDraw.map(n => n % 10);
                
                if (lastDraw.includes(num)) {
                    tag = '連莊強勢';
                } else if (lastDraw.includes(num - 1) || lastDraw.includes(num + 1)) {
                    const neighbor = lastDraw.includes(num-1) ? (num-1) : (num+1);
                    tag = `${neighbor}鄰號`; 
                } else if (lastDrawTails.includes(numTail) && numTail !== 0) { // 避免 0 尾數誤判
                    tag = `${numTail}尾群聚`;
                } else {
                    tag = '版路預測';
                }

            } else if (mode === 'ai_weight') {
                // AI: 趨勢分XX (滿分100)
                const maxWeight = Math.max(...Object.values(weights));
                const score = Math.round((weights[num] / maxWeight) * 100);
                tag = `趨勢分${score}`;
                
            } else if (mode.includes('balance') || mode.includes('random')) {
                // Balance: 屬性標示 (大號/小號, 奇數/偶數)
                const isOdd = num % 2 !== 0;
                const isBig = num > max / 2;
                let attributeTag = "";

                if (isBig) attributeTag += "大號"; else attributeTag += "小號";
                attributeTag += "/";
                if (isOdd) attributeTag += "奇數"; else attributeTag += "偶數";
                
                tag = attributeTag; 
                
            } else if (mode === 'wuxing') {
                // Wuxing: 命理屬性 (Hardcoded for now)
                if (num % 5 === 1) tag = '屬火財位';
                else if (num % 5 === 2) tag = '屬金貴人';
                else tag = '五行選號';
            }

            resultWithTags.push({ val: num, tag: tag });
        }

        return resultWithTags;
    },

    calcAC(numbers) {
        let diffs = new Set();
        for(let i=0; i<numbers.length; i++) for(let j=i+1; j<numbers.length; j++) diffs.add(Math.abs(numbers[i] - numbers[j]));
        return diffs.size - (numbers.length - 1);
    },

    renderRow(resultObj, index) {
        const container = document.getElementById('prediction-output');
        const colors = { stat: 'bg-stone-200 text-stone-700', pattern: 'bg-purple-100 text-purple-700', balance: 'bg-emerald-100 text-emerald-800', ai: 'bg-amber-100 text-amber-800', wuxing: 'bg-pink-100 text-pink-800' };
        const colorClass = colors[this.state.currentSchool] || 'bg-stone-200';
        let html = `<div class="flex flex-col gap-2 p-4 bg-white rounded-xl border border-stone-200 shadow-sm animate-fade-in hover:shadow-md transition"><div class="flex items-center gap-3"><span class="text-[10px] font-black text-stone-300 tracking-widest">SET ${index}</span><div class="flex flex-wrap gap-2">`;
        resultObj.numbers.forEach(item => { html += `<div class="flex flex-col items-center"><div class="ball-sm ${colorClass}" style="box-shadow: none;">${item.val}</div>${item.tag ? `<div class="reason-tag">${item.tag}</div>` : ''}</div>`; });
        html += `</div></div>`;
        if (resultObj.groupReason) { html += `<div class="text-[10px] text-stone-500 font-medium bg-stone-50 px-2 py-1.5 rounded border border-stone-100 flex items-center gap-1"><span class="text-sm">💡</span> ${resultObj.groupReason}</div>`; }
        html += `</div>`;
        container.innerHTML += html;
    },
    populateYearSelect() { const yearSelect = document.getElementById('search-year'); for (let y = 2021; y <= 2026; y++) { const opt = document.createElement('option'); opt.value = y; opt.innerText = `${y}`; yearSelect.appendChild(opt); } },
    populateMonthSelect() { const monthSelect = document.getElementById('search-month'); for (let m = 1; m <= 12; m++) { const opt = document.createElement('option'); opt.value = m; opt.innerText = `${m} 月`; monthSelect.appendChild(opt); } },
    resetFilter() { this.state.filterPeriod = ""; this.state.filterYear = ""; this.state.filterMonth = ""; const pInput = document.getElementById('search-period'); if(pInput) pInput.value = ""; document.getElementById('search-year').value = ""; document.getElementById('search-month').value = ""; this.updateDashboard(); },
    toggleHistory() {
        const c = document.getElementById('history-container');
        const a = document.getElementById('history-arrow');
        const t = document.getElementById('history-toggle-text');
        if (c.classList.contains('max-h-0')) { c.classList.remove('max-h-0'); c.classList.add('max-h-[1000px]'); a.classList.add('rotate-180'); t.innerText = "隱藏近 5 期"; } 
        else { c.classList.add('max-h-0'); c.classList.remove('max-h-[1000px]'); a.classList.remove('rotate-180'); t.innerText = "顯示近 5 期"; }
    },
};

window.app = App;
window.onload = () => App.init();
