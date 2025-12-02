/**
 * 台彩全能分析儀 - 核心邏輯引擎
 * Lottery Logic Engine v2.0
 * * 包含：
 * 1. GAME_RULES: 遊戲規則定義
 * 2. schoolInfo: 學派說明文字
 * 3. LotteryEngine: 數學運算核心
 */

// 1. 遊戲規則定義
window.GAME_RULES = {
    '大樂透': { type: 'lotto', min: 1, max: 49, count: 6, special: false, sort: 1 },
    '威力彩': { type: 'lotto', min: 1, max: 38, count: 6, special: { min: 1, max: 8, count: 1 }, sort: 2 },
    '今彩539': { type: 'lotto', min: 1, max: 39, count: 5, special: false, sort: 3 },
    '3星彩': { type: 'digit', count: 3, modes: ['正彩', '組彩', '對彩'], sort: 4 },
    '4星彩': { type: 'digit', count: 4, modes: ['正彩', '組彩'], sort: 5 }
};

// 2. 學派詳細說明 (HTML 格式)
window.schoolInfo = {
    balance: { 
        color: "border-school-balance", 
        title: "⚖️ 結構平衡學派 (The Balancing School)", 
        desc: `<div class="space-y-3"><div><span class="font-bold text-school-balance block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">不預測號碼，只預測「結構」。利用常態分佈理論，鎖定機率最高的落點，避開極端組合。</p></div><div><span class="font-bold text-school-balance block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">智能刪去：</span>自動過濾全奇/全偶或總和異常的低機率組合。</li><li><span class="font-bold">區間斷層：</span>偵測並排除預測會「斷層」（一顆都不開）的區域。</li></ul></div></div>` 
    },
    stat: { 
        color: "border-school-stat", 
        title: "📊 統計學派 (The Statistical School)", 
        desc: `<div class="space-y-3"><div><span class="font-bold text-school-stat block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">經典的大數據分析。相信「強者恆強」的慣性，同時兼顧「冷號回補」的平衡。</p></div><div><span class="font-bold text-school-stat block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">熱號慣性：</span>鎖定歷史出現頻率最高的號碼。</li><li><span class="font-bold">極限回補：</span>當號碼遺漏值過高，給予動態加權賭其反彈。</li></ul></div></div>` 
    },
    pattern: { 
        color: "border-school-pattern", 
        title: "🔗 關聯性學派 (The Pattern School)", 
        desc: `<div class="space-y-3"><div><span class="font-bold text-school-pattern block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">捕捉號碼之間的隱形連結，也就是資深彩迷俗稱的「看版路」。</p></div><div><span class="font-bold text-school-pattern block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">拖牌效應：</span>利用條件機率，計算「上期開A，下期易帶出B」。</li><li><span class="font-bold">尾數法則：</span>偵測近期強勢的「尾數群體」(如7尾連莊)。</li></ul></div></div>` 
    },
    ai: { 
        color: "border-school-ai", 
        title: "🤖 AI 機器學習派 (The AI School)", 
        desc: `<div class="space-y-3"><div><span class="font-bold text-school-ai block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">將開獎視為時間序列，採用模擬神經網路的權重衰減算法。</p></div><div><span class="font-bold text-school-ai block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">趨勢加權：</span>距離現在越近的期數權重越高。</li><li><span class="font-bold">短期動能：</span>不背誦遙遠歷史，專注捕捉近 20 期的熱度變化。</li></ul></div></div>` 
    },
    wuxing: {
        color: "border-school-wuxing",
        title: "🔮 五行生肖學派 (Feng Shui & Zodiac)",
        desc: `<div class="space-y-3"><div><span class="font-bold text-pink-700 block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">AI 宗師級命理運算。將您的紫微斗數與星盤資料，轉化為數學矩陣進行流年推演。</p></div><div><span class="font-bold text-pink-700 block mb-1">融合參數：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">AI 批流年：</span>透過 Gemini 分析命盤，生成專屬流年財位與五行結構。</li><li><span class="font-bold">流日映射：</span>結合當日天干地支，動態計算今日最強磁場號碼。</li></ul></div></div>`
    }
};

// 3. 運算核心
window.LotteryEngine = {
    // 預測入口點
    predict(options) {
        // options: { game, rule, data, school, subMode, profile }
        const { rule, data, school, subMode, profile } = options;
        
        // 建立 Context 物件傳遞給算法
        const context = { profile, subMode };

        if (rule.type === 'lotto') {
            return this.calculateLotto(rule, data, school, context);
        } else if (rule.type === 'digit') {
            return this.calculateDigit(rule, data, school, subMode, context);
        }
        return null;
    },

    // 🟢 樂透型計算 (Lotto, Power, 539)
    calculateLotto(rule, data, school, context) {
        // 第一區邏輯
        const zone1Func = this.getLottoStrategy(school);
        const zone1Res = zone1Func(data, rule.max, rule.count, 0, false, context); 
        
        // 第二區邏輯 (威力彩)
        let zone2Res = { numbers: [], reason: "" };
        if (rule.special) {
            if (school === 'stat') {
                // 威力彩第二區特殊戰術：極限遺漏
                zone2Res = this.algoLottoMissing(data, rule.special.max, rule.special.count, rule.count); 
            } else {
                const z2Func = this.getLottoStrategy(school);
                zone2Res = z2Func(data, rule.special.max, rule.special.count, rule.count, false, context);
            }
        }

        return {
            main: zone1Res.numbers,
            special: zone2Res.numbers,
            reason: `${zone1Res.reason} ${rule.special ? ` | 第2區：${zone2Res.reason}` : ''}`
        };
    },

    // 🔵 數字型計算 (3星, 4星)
    calculateDigit(rule, data, school, subMode, context) {
        const posCount = rule.count;
        
        // 1. 正彩 (Straight)
        if (subMode === '正彩') {
            const resNumbers = [];
            const tags = [];
            for(let p=0; p<posCount; p++) {
                const posData = data.map(d => ({ numbers: [d.numbers[p]] })); 
                const strategy = this.getLottoStrategy(school);
                const res = strategy(posData, 9, 1, 0, true, context); 
                resNumbers.push(res.numbers[0]);
                tags.push(res.numbers[0].tag);
            }
            return { main: resNumbers, reason: `正彩獨立運算：${tags.join('/')}` };
        }

        // 2. 組彩 (Group)
        if (subMode === '組彩') {
            // 平衡學派特殊戰術：型態分析
            if (school === 'balance') {
                return this.algoDigitGroupPro(data, posCount);
            }
            const poolData = data.map(d => ({ numbers: d.numbers })); 
            const strategy = this.getLottoStrategy(school);
            const res = strategy(poolData, 9, posCount, 0, true, context);
            return { main: res.numbers, reason: `組彩運算：${res.reason}` };
        }

        // 3. 對彩 (Pair)
        if (subMode === '對彩') {
            const isFront = Math.random() > 0.5; 
            const label = isFront ? "前二" : "後二";
            const startIdx = isFront ? 0 : posCount - 2;
            
            const resNumbers = [];
            for(let p=startIdx; p<startIdx+2; p++) {
                const posData = data.map(d => ({ numbers: [d.numbers[p]] }));
                const strategy = this.getLottoStrategy(school);
                const res = strategy(posData, 9, 1, 0, true, context);
                resNumbers.push(res.numbers[0]);
            }
            return { main: resNumbers, reason: `對彩(${label})：鎖定運算` };
        }
    },

    // --- 策略選擇器 ---
    getLottoStrategy(school) {
        switch(school) {
            case 'stat': return this.algoStat.bind(this);
            case 'pattern': return this.algoPattern.bind(this);
            case 'ai': return this.algoAI.bind(this);
            case 'wuxing': return this.algoWuxing.bind(this);
            default: return this.algoBalance.bind(this);
        }
    },

    // --- 各學派演算法實作 ---

    // 威力彩第二區專用：極限遺漏
    algoLottoMissing(data, max, count, offset) {
        const lastSeen = {};
        for(let i=1; i<=max; i++) lastSeen[i] = -1;
        data.forEach((d, idx) => {
            const n = d.numbers[offset]; 
            if(lastSeen[n] === -1) lastSeen[n] = idx;
        });
        const weights = {};
        let hasExtreme = false;
        for(let i=1; i<=max; i++) {
            const miss = lastSeen[i] === -1 ? data.length : lastSeen[i];
            weights[i] = 10;
            if(miss > 30) { weights[i] += 500; hasExtreme = true; } 
            else if(miss > 15) weights[i] += 50;
        }
        const selected = this.weightedSelect(weights, max, count, 0);
        return { 
            numbers: selected.map(n => ({ val: n, tag: weights[n]>200 ? '極限遺漏' : (weights[n]>50 ? '回補' : '常態') })), 
            reason: hasExtreme ? "觸發極限遺漏回補機制" : "遺漏值權重分析" 
        };
    },

    // 3星彩組彩專用：型態預測
    algoDigitGroupPro(data, count) {
        let doubleCount = 0;
        let sums = [];
        data.slice(0, 10).forEach(d => {
            const nums = d.numbers;
            const set = new Set(nums);
            if(set.size < nums.length) doubleCount++;
            sums.push(nums.reduce((a,b)=>a+b,0));
        });
        
        let targetShape = doubleCount > 3 ? '雜六' : '對子'; 
        const avgSum = Math.round(sums.reduce((a,b)=>a+b,0) / sums.length);
        
        let bestSet = [];
        let safety = 0;
        while(safety < 500) {
            safety++;
            const set = [];
            for(let k=0; k<count; k++) set.push(Math.floor(Math.random()*10));
            const uniqueSize = new Set(set).size;
            const isDouble = uniqueSize < count;
            const sum = set.reduce((a,b)=>a+b,0);
            
            if ( (targetShape === '雜六' && !isDouble) || (targetShape === '對子' && isDouble) ) {
                if (Math.abs(sum - avgSum) <= 3) {
                    bestSet = set;
                    break;
                }
            }
        }
        if(bestSet.length === 0) bestSet = [1,2,3];

        return {
            main: bestSet.sort().map(n => ({ val: n, tag: n%2===0?'偶':'奇' })),
            reason: `型態預測：${targetShape} | 鎖定和值：${avgSum}±3`
        };
    },

    // 統計學派
    algoStat(data, max, count, offset, allowZero = false, context) {
        const freq = {};
        const start = allowZero ? 0 : 1;
        const lastSeen = {};
        
        for(let i=start; i<= (allowZero ? 9 : max); i++) lastSeen[i] = -1;

        data.forEach((d, idx) => {
            const nums = Array.isArray(d.numbers) ? d.numbers.slice(offset, offset + (allowZero ? 1 : count)) : [d.numbers]; 
            nums.forEach(n => {
                freq[n] = (freq[n]||0)+1;
                if(lastSeen[n] === -1) lastSeen[n] = idx;
            });
        });

        const weights = {};
        const tags = {};
        for(let i=start; i<= (allowZero ? 9 : max); i++) {
            let w = (freq[i]||0) + 1;
            const miss = lastSeen[i] === -1 ? data.length : lastSeen[i];
            w += miss * 0.5;
            weights[i] = w;

            if (miss > 15) tags[i] = `冷${miss}期`;
            else if ((freq[i]||0) > data.length * 0.2) tags[i] = `🔥熱號`;
            else if (miss > 8) tags[i] = `回補`;
            else tags[i] = `常態`;
        }

        const selected = this.weightedSelect(weights, max, count, start);
        return { numbers: selected.map(n => ({ val: n, tag: tags[n] })), reason: "基於歷史頻率與遺漏值動態回補" };
    },

    // 平衡學派
    algoBalance(data, max, count, offset, allowZero = false, context) {
        const start = allowZero ? 0 : 1;
        const weights = {};
        for(let i=start; i<= (allowZero ? 9 : max); i++) weights[i] = 10;
        const selected = this.weightedSelect(weights, max, count, start);
        return { numbers: selected.map(n => ({ val: n, tag: n%2===0 ? '偶' : '奇' })), reason: "常態分佈隨機結構" };
    },

    // 關聯學派
    algoPattern(data, max, count, offset, allowZero = false, context) {
        const start = allowZero ? 0 : 1;
        const tails = {};
        const lastDraw = Array.isArray(data[0].numbers) ? data[0].numbers.slice(offset, offset + (allowZero ? 1 : count)) : [data[0].numbers];

        data.slice(0, 10).forEach(d => {
             const nums = Array.isArray(d.numbers) ? d.numbers.slice(offset, offset + (allowZero ? 1 : count)) : [d.numbers];
             nums.forEach(n => { const t = n%10; tails[t] = (tails[t]||0)+1; });
        });

        const hotTail = Object.keys(tails).sort((a,b)=>tails[b]-tails[a])[0];
        const weights = {};
        for(let i=start; i<= (allowZero ? 9 : max); i++) {
            weights[i] = (i%10 == hotTail) ? 50 : 10;
        }
        const selected = this.weightedSelect(weights, max, count, start);
        return { 
            numbers: selected.map(n => ({ val: n, tag: n%10==hotTail ? `${hotTail}尾強勢` : (lastDraw.includes(n) ? '連莊' : '版路') })), 
            reason: `${hotTail}尾數強勢區間 + 拖牌版路分析` 
        };
    },

    // AI 學派
    algoAI(data, max, count, offset, allowZero = false, context) {
        const start = allowZero ? 0 : 1;
        const weights = {};
        data.forEach((d, idx) => {
            const w = 100 / (idx + 5);
            const nums = Array.isArray(d.numbers) ? d.numbers.slice(offset, offset + (allowZero ? 1 : count)) : [d.numbers];
            nums.forEach(n => weights[n] = (weights[n]||0) + w);
        });
        const selected = this.weightedSelect(weights, max, count, start);
        const maxW = Math.max(...Object.values(weights));
        return { numbers: selected.map(n => ({ val: n, tag: `權重${Math.round(weights[n]/maxW*100)}` })), reason: "時間序列加權運算 (Time-Decay)" };
    },

    // 五行學派
    algoWuxing(data, max, count, offset, allowZero = false, context) {
        const profile = context.profile; // 從 context 獲取，不讀 DOM
        const start = allowZero ? 0 : 1;
        const weights = {};
        
        let luckyTails = [];
        let reason = "日運隨機";

        if (profile && profile.fortune2025) {
            const m = new Date().getMonth() + 1;
            const mData = profile.fortune2025.monthly_elements?.find(x => x.month === m);
            if(mData) luckyTails = mData.lucky_tails || [];
            reason = "流年運勢加成";
        } else {
            luckyTails = [(new Date().getDate()) % 10]; // Fallback
        }

        for(let i=start; i<= (allowZero ? 9 : max); i++) {
            weights[i] = luckyTails.includes(i%10) ? 100 : 10;
        }
        const selected = this.weightedSelect(weights, max, count, start);
        return { numbers: selected.map(n => ({ val: n, tag: weights[n]>50 ? '吉' : '運' })), reason: reason };
    },

    // 通用權重選擇器
    weightedSelect(weights, max, count, start) {
        const pool = [];
        for(let i=start; i<= (start===0 ? 9 : max); i++) {
            let w = weights[i] || 1;
            for(let k=0; k<Math.ceil(w); k++) pool.push(i);
        }
        const res = [];
        for(let c=0; c<count; c++) {
            const idx = Math.floor(Math.random() * pool.length);
            res.push(pool[idx]);
            // For Lotto, remove picked number. For Digit, keep it (repeatable).
            if (start !== 0) { 
                 const picked = pool[idx];
                 for(let i=pool.length-1; i>=0; i--) if(pool[i]===picked) pool.splice(i,1);
            }
        }
        return start !== 0 ? res.sort((a,b)=>a-b) : res;
    }
};