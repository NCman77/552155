/**
 * gameLogic.js
 * 台彩全能分析儀 - 核心運算引擎
 * * 職責：
 * 1. 定義各戰術流派的詳細說明 (School Info)
 * 2. 執行數學統計與分析演算法 (Algorithms)
 * 3. 純粹的資料處理，不涉及任何 DOM 操作或 UI 顯示
 * * 未來遷移至 Firebase Cloud Functions 時，主要遷移此檔案內容。
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
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-balance block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">不預測號碼，只預測「結構」。利用常態分佈理論，鎖定機率最高的落點，避開極端組合。</p></div><div><span class="font-bold text-school-balance block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">智能刪去：</span>自動過濾全奇/全偶或總和異常的低機率組合。</li><li><span class="font-bold">區間斷層：</span>偵測並排除預測會「斷層」（一顆都不開）的區域。</li></ul></div><div class="bg-green-50 p-3 rounded-lg border border-green-100"><span class="font-bold text-green-700 text-xs block mb-1">💡 選號密技：</span><p class="text-xs text-green-800">請優先留意帶有「🚫 斷區排除」標籤的組合，這代表它符合強勢統計模型，勝率期望值通常較高。</p></div></div>` 
        },
        stat: { 
            color: "border-school-stat", 
            title: "統計學派 (The Statistical School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-stat block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">經典的大數據分析。相信「強者恆強」的慣性，同時兼顧「冷號回補」的平衡。</p></div><div><span class="font-bold text-school-stat block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">熱號慣性：</span>鎖定歷史出現頻率最高的號碼。</li><li><span class="font-bold">極限回補：</span>當號碼遺漏值過高，給予動態加權賭其反彈。</li></ul></div></div>` 
        },
        pattern: { 
            color: "border-school-pattern", 
            title: "關聯性學派 (The Pattern School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-pattern block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">捕捉號碼之間的隱形連結，也就是資深彩迷俗稱的「看版路」。</p></div><div><span class="font-bold text-school-pattern block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">拖牌效應：</span>利用條件機率，計算「上期開A，下期易帶出B」。</li><li><span class="font-bold">尾數法則：</span>偵測近期強勢的「尾數群體」(如7尾連莊)。</li></ul></div></div>` 
        },
        ai: { 
            color: "border-school-ai", 
            title: "AI 機器學習派 (The AI School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-ai block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">將開獎視為時間序列，採用模擬神經網路的權重衰減算法。</p></div><div><span class="font-bold text-school-ai block mb-1">篩選重點：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">趨勢加權：</span>距離現在越近的期數權重越高。</li><li><span class="font-bold">短期動能：</span>不背誦遙遠歷史，專注捕捉近 20 期的熱度變化。</li></ul></div></div>` 
        },
        wuxing: {
            color: "border-school-wuxing",
            title: "🔮 五行生肖學派 (Feng Shui & Zodiac)",
            desc: `<div class="space-y-3"><div><span class="font-bold text-pink-700 block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">AI 宗師級命理運算。將您的紫微斗數與星盤資料，轉化為數學矩陣進行流年推演。</p></div><div><span class="font-bold text-pink-700 block mb-1">融合參數：</span><ul class="list-disc pl-4 text-sm text-stone-600 space-y-1"><li><span class="font-bold">AI 批流年：</span>透過 Gemini 分析命盤，生成專屬流年財位與五行結構。</li><li><span class="font-bold">流日映射：</span>結合當日天干地支，動態計算今日最強磁場號碼。</li></ul></div></div>`
        }
    };

    // ==========================================
    // 2. 工具函數 (Helper Functions)
    // ==========================================
    
    /**
     * 加權隨機選擇器
     * @param {Object} weights - 權重物件 {號碼: 權重值}
     * @param {number} maxN - 最大號碼
     * @param {number} count - 需要選擇的數量
     * @returns {Array} - 選出的號碼陣列
     */
    function weightedRandomSelect(weights, maxN, count) {
        let pool = [];
        for (let i = 1; i <= maxN; i++) {
            let w = weights[i] || 1;
            w = Math.ceil(w);
            // 限制最大權重，避免 overflow 或極端偏差
            if (w > 1000) w = 1000; 
            for (let k = 0; k < w; k++) pool.push(i);
        }

        const res = new Set();
        let safety = 0;
        
        // 第一階段：從權重池中抽取
        while (res.size < count && safety < 10000) {
            if (pool.length === 0) break;
            const idx = Math.floor(Math.random() * pool.length);
            const n = pool[idx];
            res.add(n);
            safety++;
        }

        // 第二階段：若數量不足（極端情況），補足剩餘號碼
        while (res.size < count) {
            let n = Math.floor(Math.random() * maxN) + 1;
            res.add(n);
        }

        return Array.from(res).sort((a, b) => a - b);
    }

    // ==========================================
    // 3. 各流派演算法 (Algorithms)
    // ==========================================

    const Algorithms = {
        
        /**
         * 五行生肖學派演算法
         */
        wuxing: function(data, maxN, count, options = {}) {
            const { profile, usePurple, useAstro, useName, useZodiac } = options;
            
            const weights = {};
            for (let i = 1; i <= maxN; i++) weights[i] = 10;
            const numReasons = {};
            let groupReasons = [];

            if (profile) {
                // AI 流年邏輯
                if (profile.fortune2025) {
                    const month = new Date().getMonth() + 1;
                    const mData = profile.fortune2025.monthly_elements?.find(m => m.month === month);
                    if (mData) {
                        const luckyTails = mData.lucky_tails || [];
                        if (usePurple || useAstro || useZodiac) {
                            for (let i = 1; i <= maxN; i++) {
                                if (luckyTails.includes(i % 10)) {
                                    weights[i] += 50;
                                    numReasons[i] = "流年旺";
                                }
                            }
                            groupReasons.push(`AI流年:利${luckyTails.join(',')}尾`);
                        }
                    }
                } else if (useZodiac || usePurple || useAstro) {
                    // 降級處理：無 AI 資料時的基礎邏輯
                    groupReasons.push("基礎命理(建議啟用AI)");
                    const todayTail = new Date().getDate() % 10;
                    for (let i = 1; i <= maxN; i++) {
                        if (i % 10 === todayTail) {
                            weights[i] += 20;
                            numReasons[i] = "日運";
                        }
                    }
                }
                
                // 姓名學邏輯
                if (useName && profile.realname) {
                    const len = profile.realname.length; 
                    const luckyNum = (len * 7) % maxN || 1;
                    weights[luckyNum] += 60;
                    numReasons[luckyNum] = "姓名格";
                    groupReasons.push(`姓名靈動`);
                }

            } else {
                groupReasons.push("隨機運勢 (未選主角)");
            }

            // 加入些微隨機擾動，模擬運勢的無常
            for (let k in weights) weights[k] *= (0.8 + Math.random() * 0.4);
            
            const selected = weightedRandomSelect(weights, maxN, count);
            
            return { 
                numbers: selected.map(n => ({ 
                    val: n, 
                    tag: numReasons[n] || (weights[n] > 30 ? "吉" : "") 
                })), 
                groupReason: `運勢盤：${groupReasons.join(' + ') || '綜合運勢'}` 
            };
        },

        /**
         * 統計學派演算法
         */
        stat: function(data, maxN, count) {
            const freq = {};
            data.forEach(d => d.numbers.forEach(n => freq[n] = (freq[n] || 0) + 1));
            
            const lastSeen = {};
            for (let i = 1; i <= maxN; i++) lastSeen[i] = -1;
            
            data.forEach((d, idx) => {
                d.numbers.forEach(n => {
                    if (lastSeen[n] === -1) lastSeen[n] = idx;
                });
            });

            const weights = {};
            const tags = {};
            
            for (let i = 1; i <= maxN; i++) {
                let w = freq[i] || 0;
                // 遺漏值加權 (Miss Value Weighting)
                const miss = lastSeen[i] === -1 ? data.length : lastSeen[i];
                w += (miss * 0.5); 
                
                if (miss > 15) tags[i] = `冷${miss}期`;
                else if (freq[i] > data.length * 0.15) tags[i] = "熱號";
                else tags[i] = "常態";
                
                if (w > 500) w = 500;
                weights[i] = w;
            }

            const selected = weightedRandomSelect(weights, maxN, count);
            return { 
                numbers: selected.map(n => ({ val: n, tag: tags[n] })), 
                groupReason: "根據歷史頻率與遺漏值動態回補" 
            };
        },

        /**
         * 關聯學派演算法 (版路)
         */
        pattern: function(data, maxN, count) {
            if (data.length < 2) return this.stat(data, maxN, count); // 資料不足降級
            
            const lastDraw = data[0].numbers;
            const nextDrawCounts = {};
            const relationMap = {};
            const tailCounts = {};
            
            // 分析近期尾數
            data.slice(0, 10).forEach(d => {
                d.numbers.forEach(n => {
                    const tail = n % 10;
                    tailCounts[tail] = (tailCounts[tail] || 0) + 1;
                });
            });
            const hotTail = Object.entries(tailCounts).sort((a, b) => b[1] - a[1])[0][0];

            // 拖牌分析
            for (let i = 1; i < data.length; i++) {
                const intersection = data[i].numbers.filter(n => lastDraw.includes(n));
                if (intersection.length > 0) {
                    data[i - 1].numbers.forEach(n => {
                        nextDrawCounts[n] = (nextDrawCounts[n] || 0) + intersection.length;
                        if (!relationMap[n]) relationMap[n] = intersection[0];
                    });
                }
            }

            // 防呆
            if (Object.keys(nextDrawCounts).length === 0) return this.stat(data, maxN, count);

            // 尾數加權
            for (let k in nextDrawCounts) {
                if (k % 10 == hotTail) nextDrawCounts[k] *= 1.5;
                nextDrawCounts[k] *= (0.9 + Math.random() * 0.2);
            }

            const selected = weightedRandomSelect(nextDrawCounts, maxN, count);
            return { 
                numbers: selected.map(n => ({ 
                    val: n, 
                    tag: relationMap[n] ? `由${relationMap[n]}拖牌` : (n % 10 == hotTail ? `${hotTail}尾強勢` : '關聯') 
                })), 
                groupReason: `上期[${lastDraw.slice(0, 3).join(',')}]拖牌 + ${hotTail}尾數趨勢融合` 
            };
        },

        /**
         * 平衡學派演算法 (結構)
         */
        balance: function(data, maxN, count) {
            let bestSet = [];
            let minScore = 99999;
            let bestInfo = {};
            const zoneCounts = [0, 0, 0, 0, 0];
            
            // 分析近期斷層區間
            data.slice(0, 30).forEach(d => {
                d.numbers.forEach(n => {
                    if (n <= 9) zoneCounts[0]++;
                    else if (n <= 19) zoneCounts[1]++;
                    else if (n <= 29) zoneCounts[2]++;
                    else if (n <= 39) zoneCounts[3]++;
                    else zoneCounts[4]++;
                });
            });
            const coldZoneIdx = zoneCounts.indexOf(Math.min(...zoneCounts));

            // Monte Carlo 模擬
            for (let k = 0; k < 500; k++) {
                const set = [];
                const pool = Array.from({ length: maxN }, (_, i) => i + 1);
                
                // 50% 機率嘗試排除最冷區間 (斷層理論)
                if (Math.random() > 0.5) {
                    const start = coldZoneIdx * 10;
                    const end = start + 9;
                    for (let i = pool.length - 1; i >= 0; i--) {
                        if (pool[i] >= start && pool[i] <= end) pool.splice(i, 1);
                    }
                }

                for (let i = 0; i < count; i++) {
                    if (pool.length === 0) break;
                    const idx = Math.floor(Math.random() * pool.length);
                    set.push(pool[idx]);
                    pool.splice(idx, 1);
                }
                set.sort((a, b) => a - b);
                if (set.length < count) continue;

                // 計算結構分數
                let odd = set.filter(n => n % 2 !== 0).length;
                let even = count - odd;
                let diffOE = Math.abs(odd - even);
                
                let sum = set.reduce((a, b) => a + b, 0);
                let expectedSum = (1 + maxN) * count / 2;
                let diffSum = Math.abs(sum - expectedSum) / expectedSum;
                
                // 分數越低越好 (越接近常態分佈)
                let score = (diffOE * 15) + (diffSum * 50);

                if (score < minScore) {
                    minScore = score;
                    bestSet = set;
                    bestInfo = { odd, even, sum };
                }
            }

            const setZones = [0, 0, 0, 0, 0];
            bestSet.forEach(n => {
                if (n <= 9) setZones[0]++;
                else if (n <= 19) setZones[1]++;
                else if (n <= 29) setZones[2]++;
                else if (n <= 39) setZones[3]++;
                else setZones[4]++;
            });
            const emptyZone = setZones.findIndex(z => z === 0);
            const zoneMsg = emptyZone > -1 ? `🚫 斷第${emptyZone + 1}區` : "";

            return { 
                numbers: bestSet.map(n => ({ val: n, tag: n % 2 === 0 ? '偶' : '奇' })), 
                groupReason: `結構：${bestInfo.odd}奇${bestInfo.even}偶 | 總和 ${bestInfo.sum} | ${zoneMsg}` 
            };
        },

        /**
         * AI 學派演算法 (模擬)
         */
        ai: function(data, maxN, count) {
            const weights = {};
            // 時間衰減加權 (Time Decay)
            data.forEach((d, idx) => {
                const weight = 1000 / (idx + 10);
                d.numbers.forEach(n => weights[n] = (weights[n] || 0) + weight);
            });
            
            const selected = weightedRandomSelect(weights, maxN, count);
            const maxW = Math.max(...Object.values(weights));
            
            return { 
                numbers: selected.map(n => ({ val: n, tag: `權重${Math.round(weights[n] / maxW * 100)}` })), 
                groupReason: "基於近期趨勢的時間加權運算 (非神經網路)" 
            };
        }
    };

    // ==========================================
    // 4. 模組導出 (Expose to Window)
    // ==========================================
    
    // 建立全域物件 LotteryEngine
    global.LotteryEngine = {
        // 屬性
        schoolInfo: SCHOOL_INFO,
        
        // 方法
        calculate: function(schoolType, data, maxN, count, options) {
            if (!Algorithms[schoolType]) {
                console.error(`Unknown school type: ${schoolType}`);
                return null;
            }
            try {
                return Algorithms[schoolType](data, maxN, count, options);
            } catch (error) {
                console.error("Calculation Error:", error);
                return null;
            }
        }
    };

    console.log("LotteryEngine loaded successfully.");

})(window);