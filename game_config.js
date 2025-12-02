/**
 * game_config.js
 * 存放遊戲定義、規則文字、玩法選項等靜態資料
 */

export const GAME_CONFIG = {
    // 遊戲定義
    GAMES: {
        '大樂透': {
            type: 'lotto', // 樂透型 (不重複號碼)
            range: 49,     // 1-49
            count: 6,      // 選6顆
            special: true, // 有特別號
            desc: "在01~49中選取6個號碼，每週二、五開獎。",
            subModes: null // 無子玩法
        },
        '威力彩': {
            type: 'lotto',
            range: 38,
            count: 6,
            special: true, // 第二區
            specialRange: 8,
            desc: "第一區01~38選6個，第二區01~08選1個，每週一、四開獎。",
            subModes: null
        },
        '今彩539': {
            type: 'lotto',
            range: 39,
            count: 5,
            special: false,
            desc: "01~39選5個，每週一至六開獎。",
            subModes: null
        },
        '3星彩': {
            type: 'digit', // 數字型 (0-9，可重複)
            range: 9,      // 0-9
            count: 3,
            desc: "從000~999中選號，分為正彩、組彩、對彩。",
            // 子玩法定義
            subModes: [
                { id: 'direct', name: '正彩', count: 3, rule: '需數字與位置完全對中' },
                { id: 'group', name: '組彩', count: 3, rule: '數字對中即可，不限位置 (含組彩/6組彩/3組彩)' },
                { id: 'pair', name: '對彩', count: 2, rule: '僅需對中前兩碼或後兩碼' }
            ],
            // 詳細規則文章
            article: `
                <div class="space-y-4 text-sm text-stone-600 leading-relaxed">
                    <h5 class="font-bold text-stone-800">三星彩玩法規則</h5>
                    <p><strong>1. 正彩：</strong>數字與位置需完全相同。機率 1/1000。</p>
                    <p><strong>2. 組彩：</strong>三個數字相同即可，不限順序。例如開獎 123，買 321 也中獎。</p>
                    <p><strong>3. 對彩：</strong>只對前兩碼或後兩碼。機率 1/100。</p>
                    <div class="bg-yellow-50 p-3 rounded border border-yellow-100">
                        <span class="font-bold text-yellow-700">💡 新手建議：</span>
                        <ul class="list-disc pl-4 mt-1">
                            <li>穩健型：對彩 (中獎率高)</li>
                            <li>平衡型：組彩 (兼顧機率與獎金)</li>
                            <li>進取型：正彩 (拚高額獎金)</li>
                        </ul>
                    </div>
                </div>
            `
        },
        '4星彩': {
            type: 'digit',
            range: 9,
            count: 4,
            desc: "從0000~9999中選號，分為正彩、組彩。",
            subModes: [
                { id: 'direct', name: '正彩', count: 4, rule: '需數字與位置完全對中' },
                { id: 'group', name: '組彩', count: 4, rule: '數字對中即可，不限位置 (含24組/12組/6組/4組)' }
            ],
            article: `
                <div class="space-y-4 text-sm text-stone-600 leading-relaxed">
                    <h5 class="font-bold text-stone-800">四星彩玩法規則</h5>
                    <p><strong>1. 正彩：</strong>四個數字與位置需完全相同。機率 1/10000。</p>
                    <p><strong>2. 組彩：</strong>四個數字相同即可，不限順序。</p>
                    <ul class="list-disc pl-4 mt-1 text-xs">
                        <li>24組彩：4個數字皆不同</li>
                        <li>12組彩：含2個相同數字</li>
                        <li>6組彩：含2組相同數字</li>
                        <li>4組彩：含3個相同數字</li>
                    </ul>
                </div>
            `
        }
    },
    // 顯示順序
    ORDER: ['大樂透', '威力彩', '今彩539', '3星彩', '4星彩'],
    
    // 學派說明 (為了保持 app.js 乾淨，也移到這裡)
    SCHOOLS: {
        balance: { 
            color: "border-school-balance", 
            title: "結構平衡學派 (The Balancing School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-balance block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">不預測號碼，只預測「結構」。利用常態分佈理論，鎖定機率最高的落點。</p></div></div>` 
        },
        stat: { 
            color: "border-school-stat", 
            title: "統計學派 (The Statistical School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-stat block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">大數據分析。相信「強者恆強」與「冷號回補」的平衡。</p></div></div>` 
        },
        pattern: { 
            color: "border-school-pattern", 
            title: "關聯性學派 (The Pattern School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-pattern block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">捕捉號碼之間的隱形連結，也就是資深彩迷俗稱的「看版路」。</p></div></div>` 
        },
        ai: { 
            color: "border-school-ai", 
            title: "AI 機器學習派 (The AI School)", 
            desc: `<div class="space-y-3"><div><span class="font-bold text-school-ai block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">將開獎視為時間序列，採用模擬神經網路的權重衰減算法。</p></div></div>` 
        },
        wuxing: {
            color: "border-school-wuxing",
            title: "🔮 五行生肖學派 (Feng Shui & Zodiac)",
            desc: `<div class="space-y-3"><div><span class="font-bold text-pink-700 block mb-1">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">AI 宗師級命理運算。將您的紫微斗數與星盤資料，轉化為數學矩陣進行流年推演。</p></div></div>`
        }
    }
};