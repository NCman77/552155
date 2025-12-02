/**
 * gameLogic.js
 * 台彩全能分析儀 - 核心運算引擎 (Core Logic Engine)
 * * 職責：
 * 1. 定義戰術流派 (School Info)
 * 2. 執行複雜的數學統計與分析演算法 (Strategy Pattern)
 * 3. 支援多種遊戲模式：標準型、雙區型(威力彩)、數字型(3星/4星彩)
 */

(function(global) {
    'use strict';

    // ==========================================
    // 1. 流派定義與說明 (School Definitions)
    // ==========================================
    const SCHOOL_INFO = {
        balance: { 
            color: "border-school-balance", 
            title: "結構平衡學派 (The Balancing School)", 
            desc: `不預測號碼，只預測「結構」。<br>適合玩法：<b class="text-green-700">3星組彩、樂透全餐</b>。<br>利用和值常態分佈，過濾掉極端組合。` 
        },
        stat: { 
            color: "border-school-stat", 
            title: "統計學派 (The Statistical School)", 
            desc: `經典大數據分析。<br>適合玩法：<b class="text-slate-700">3星對彩、威力彩第二區</b>。<br>針對特定位置進行冷熱號追蹤與回補。` 
        },
        pattern: { 
            color: "border-school-pattern", 
            title: "關聯性學派 (The Pattern School)", 
            desc: `捕捉隱形連結。<br>適合玩法：<b class="text-purple-700">3星正彩、樂透拖牌</b>。<br>分析對子、順子與跨期拖牌規律。` 
        },
        ai: { 
            color: "border-school-ai", 
            title: "AI 機器學習派 (The AI School)", 
            desc: `時間序列權重運算。<br>適合玩法：<b class="text-amber-700">3星正彩、全彩種</b>。<br>模擬趨勢動能，給予近期訊號高權重。` 
        },
        wuxing: {
            color: "border-school-wuxing",
            title: "🔮 五行生肖學派 (Feng Shui & Zodiac)",
            desc: `AI 宗師級命理運算。<br>適合玩法：<b class="text-pink-700">全彩種個人化</b>。<br>流年運勢結合當日磁場，產出專屬號碼。`
        }
    };

    // ==========================================
    // 2. 工具函數 (Helper Functions)
    // ==========================================
    
    /**
     * 加權隨機選擇器
     * @param {Object} weights - 權重物件 {號碼: 權重值}
     * @param {number} maxN - 最大號碼 (或是 0-9 的 9)
     * @param {number} count - 需要選擇的數量
     * @param {boolean} allowRepeat - 是否允許重複 (樂透否, 3星彩是)
     */
    function weightedRandomSelect(weights, maxN, count, allowRepeat = false) {
        let pool = [];
        // 如果是允許重複(3星彩)，通常是0-9；樂透通常是1-N
        const start = allowRepeat ? 0 : 1;
        
        for (let i = start; i <= maxN; i++) {
            let w = weights[i] || 1;
            w = Math.ceil(w);
            if (w > 1000) w = 1000; // Cap weights
            for (let k = 0; k < w; k++) pool.push(i);
        }

        const res = [];
        let safety = 0;
        
        while (res.length < count && safety < 10000) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            const val = pool[idx];
            
            if (!allowRepeat && res.includes(val)) continue; // 樂透防重複
            
            res.push(val);
            
            if (!allowRepeat) {
                // 若不允許重複，從池中移除該號碼的所有實例 (效能優化版：只移除當前索引是不夠的，因為池中有重複號碼代表權重)
                // 這裡簡化邏輯：因為 pool 是展開的權重陣列，直接 filter 移除所有該數值
                pool = pool.filter(v => v !== val);
            }
            safety++;
        }

        // 樂透需要排序，數字遊戲(3星彩)通常看順序(除非是組彩，但這裡先回傳原始順序)
        // 為了通用性，若允許重複(數字遊戲)則不排，否則(樂透)排序
        return allowRepeat ? res : res.sort((a, b) => a - b);
    }

    // ==========================================
    // 3. 策略演算法 (Algorithms)
    // ==========================================

    const Algorithms = {
        
        /**
         * 統一入口點
         * @param {string} type - 學派名稱 (stat, balance...)
         * @param {Array} data - 歷史資料
         * @param {Object} config - 遊戲設定 (包含 min, max, count, mode, type...)
         * @param {Object} options - 額外參數 (profile, toggles...)
         */
        run: function(type, data, config, options) {
            // 根據遊戲類型分流 (Strategy Pattern)
            if (config.type === 'two-zone') {
                return this.runTwoZone(type, data, config, options);
            } else if (config.type === 'digit') {
                return this.runDigit(type, data, config, options);
            } else {
                return this.runStandard(type, data, config, options);
            }
        },

        // --- 策略 A: 威力彩 (雙區) ---
        runTwoZone: function(school, data, config, options) {
            // 分別計算第一區與第二區
            const zone1Res = this._runLogic(school, data, config.zone1, options);
            // 第二區通常只有一個號碼，視為 count=1 的標準樂透
            const zone2Res = this._runLogic(school, data, config.zone2, { ...options, isZone2: true });
            
            return { 
                numbers: zone1Res.numbers, 
                special: zone2Res.numbers[0], // 第二區號碼
                groupReason: zone1Res.groupReason 
            };
        },

        // --- 策略 B: 3星彩/4星彩 (數字型) ---
        runDigit: function(school, data, config, options) {
            return this._runLogicDigit(school, data, config, options);
        },

        // --- 策略 C: 一般樂透 ---
        runStandard: function(school, data, config, options) {
            return this._runLogic(school, data, config, options);
        },

        // --- 內部邏輯：標準樂透運算 (不重複) ---
        _runLogic: function(school, data, config, options) {
            const { max, count } = config;
            
            // 1. 五行學派 (特殊處理)
            if (school === 'wuxing') {
                const { profile, usePurple, useName } = options;
                const weights = {}; 
                for(let i=1; i<=max; i++) weights[i] = 10;
                const reasons = {};
                let reasonText = "隨機運勢";
                
                if (profile && profile.fortune2025) {
                    reasonText = "AI流年加權";
                    const m = new Date().getMonth() + 1;
                    const tails = profile.fortune2025.monthly_elements?.find(x => x.month === m)?.lucky_tails || [];
                    for(let i=1; i<=max; i++) {
                        if(tails.includes(i % 10)) { 
                            weights[i] += 50; 
                            reasons[i] = "流年旺"; 
                        }
                    }
                }
                
                if (profile && useName) {
                    const luck = (profile.realname?.length * 7) % max || 1;
                    weights[luck] += 60; 
                    reasons[luck] = "姓名格";
                }
                
                // 加入擾動
                for(let k in weights) weights[k] *= (0.8 + Math.random() * 0.4);
                
                const nums = weightedRandomSelect(weights, max, count, false);
                return { 
                    numbers: nums.map(v => ({val: v, tag: reasons[v] || ''})), 
                    groupReason: reasonText 
                };
            }
            
            // 2. 統計學派
            if (school === 'stat') {
                const freq = {};
                // 只統計該區的號碼 (若是威力彩第二區，data 資料結構可能需要適配，這裡簡化假設 data 為標準結構)
                data.forEach(d => {
                    // 若是雙區遊戲，這裡假設 data 已經是該區的資料，或簡單取前 N 個
                    const targetNums = options.isZone2 ? [d.numbers[d.numbers.length-1]] : d.numbers.slice(0, count);
                    targetNums.forEach(n => freq[n] = (freq[n] || 0) + 1);
                });

                const weights = {}; 
                const tags = {};
                for(let i=1; i<=max; i++) {
                    weights[i] = (freq[i] || 0) + (Math.random() * 5);
                    if(freq[i] > data.length * 0.2) tags[i] = "熱";
                }
                
                const nums = weightedRandomSelect(weights, max, count, false);
                return { 
                    numbers: nums.map(v => ({val: v, tag: tags[v] || ''})), 
                    groupReason: options.isZone2 ? "第二區冷熱" : "歷史冷熱回補" 
                };
            }
            
            // 3. 其他學派 (簡化為權重隨機，實際可擴充 pattern/ai 邏輯)
            const nums = weightedRandomSelect({}, max, count, false);
            return { 
                numbers: nums.map(v => ({val: v, tag: ''})), 
                groupReason: "綜合隨機運算" 
            };
        },

        // --- 內部邏輯：數字型運算 (0-9, 可重複) ---
        _runLogicDigit: function(school, data, config, options) {
            const { count, mode } = config; // mode: 'straight'(正), 'group'(組), 'pair'(對)
            const max = 9;
            
            // A. 平衡學派：組彩首選 (和值法)
            if (school === 'balance') {
                let bestSet = []; 
                let minDiff = 999;
                const targetSum = Math.floor(9 * count / 2); // 期望值 (3星彩約 13.5)
                
                // Monte Carlo 模擬
                for(let k=0; k<200; k++) {
                    const set = weightedRandomSelect({}, 9, count, true); // 允許重複
                    const sum = set.reduce((a, b) => a + b, 0);
                    
                    // 組彩特殊規則：通常不含豹子(三同號)，且不看順序
                    if (mode === 'group') {
                        if (new Set(set).size === 1) continue; // 排除 000, 111...
                        set.sort((a,b)=>a-b); // 組彩習慣排序顯示
                    }
                    
                    const diff = Math.abs(sum - targetSum);
                    // 尋找最接近常態分佈峰值的組合
                    if (diff < minDiff) { 
                        minDiff = diff; 
                        bestSet = set; 
                    }
                }
                
                const sum = bestSet.reduce((a, b) => a + b, 0);
                return { 
                    numbers: bestSet.map(v => ({val: v, tag: ''})), 
                    groupReason: `和值 ${sum} (常態峰值) | ${mode === 'group' ? '建議組彩(不限順序)' : '正彩結構'}` 
                };
            }

            // B. 統計學派：對彩首選 (位置分析)
            if (school === 'stat') {
                // 統計每個位置(百/十/個)的 0-9 頻率
                const posWeights = Array.from({length: count}, () => ({}));
                data.slice(0, 50).forEach(d => {
                    // 假設 3星彩 data.numbers = [1, 2, 3]
                    d.numbers.forEach((n, idx) => { 
                        if(idx < count) posWeights[idx][n] = (posWeights[idx][n] || 0) + 1; 
                    });
                });
                
                const res = [];
                for(let i=0; i<count; i++) {
                    // 對彩邏輯：如果是對彩，這裡應該只針對 "前兩碼" 或 "後兩碼" 強化
                    // 這裡做一個通用強化：針對每個位置選熱號
                    let w = posWeights[i];
                    // 補齊 0-9 權重
                    for(let k=0; k<=9; k++) if(!w[k]) w[k] = 0;
                    
                    const val = weightedRandomSelect(w, 9, 1, true)[0];
                    const isHot = w[val] > 5; // 簡單閾值
                    res.push({val: val, tag: isHot ? '位熱' : '回補'});
                }
                
                let reason = "位置落點統計";
                if (mode === 'pair') reason += " (適合對彩)";
                return { numbers: res, groupReason: reason };
            }

            // C. 預設/AI/關聯 (簡化)
            const res = weightedRandomSelect({}, 9, count, true);
            // 若是組彩，排序方便閱讀
            if (mode === 'group') res.sort((a,b)=>a-b);
            
            return { 
                numbers: res.map(v => ({val: v, tag: ''})), 
                groupReason: "機率模型演算" 
            };
        }
    };

    // ==========================================
    // 4. 模組導出 (Expose to Window)
    // ==========================================
    
    global.LotteryEngine = {
        schoolInfo: SCHOOL_INFO,
        /**
         * 外部呼叫介面
         * @param {string} schoolType - 流派
         * @param {Array} data - 歷史資料
         * @param {Object} config - 完整的遊戲設定 (從 index.html 傳入)
         * @param {Object} options - 使用者選項
         */
        calculate: function(schoolType, data, config, options) {
            if (!Algorithms[schoolType]) {
                console.error(`Unknown school type: ${schoolType}`);
                // 降級回傳隨機
                return null;
            }
            try {
                return Algorithms.run(schoolType, data, config, options);
            } catch (error) {
                console.error("Calculation Error:", error);
                return null;
            }
        }
    };

    console.log("LotteryEngine (v2.0 Advanced) loaded successfully.");

})(window);
