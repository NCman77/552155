/**
 * game_config.js
 * 存放遊戲定義、規則文字、玩法選項等靜態資料
 * 包含：標準型(lotto)、雙區型(power)、數字型(digit) 的區分
 */

export const GAME_CONFIG = {
    // 遊戲定義
    GAMES: {
        '大樂透': {
            type: 'lotto', // 標準樂透型
            range: 49,
            count: 6,
            special: true, // 有特別號但邏輯上是從同一個池選
            desc: "在01~49中選取6個號碼，每週二、五開獎。",
            subModes: null
        },
        '威力彩': {
            type: 'power', // 雙區型 (最複雜)
            range: 38,     // 第一區 1-38
            count: 6,
            zone2: 8,      // 第二區 1-8
            desc: "第一區01~38選6個，第二區01~08選1個。",
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
            type: 'digit', // 數字型
            range: 9,      // 0-9
            count: 3,
            desc: "從000~999中選號，分為正彩、組彩、對彩。",
            subModes: [
                { id: 'direct', name: '🔴 正彩', count: 3, rule: '需數字與位置完全對中' },
                { id: 'group', name: '🔵 組彩', count: 3, rule: '數字對中即可，不限位置' },
                { id: 'pair', name: '🟢 對彩', count: 2, rule: '僅需對中前兩碼或後兩碼' }
            ],
            article: `
                <div class="space-y-4 text-sm text-stone-600 leading-relaxed">
                    <h5 class="font-bold text-stone-800 text-lg">三星彩玩法規則</h5>
                    <div class="p-3 bg-white rounded border border-stone-200">
                        <strong class="block mb-1">1. 正彩 (Direct)</strong>
                        <p>數字與位置需完全相同。機率 1/1000。適合追求高賠率的玩家。</p>
                    </div>
                    <div class="p-3 bg-white rounded border border-stone-200">
                        <strong class="block mb-1">2. 組彩 (Group)</strong>
                        <p>三個數字相同即可，不限順序。例如開獎 123，買 321 也中獎。</p>
                    </div>
                    <div class="p-3 bg-white rounded border border-stone-200">
                        <strong class="block mb-1">3. 對彩 (Pair)</strong>
                        <p>只對前兩碼或後兩碼。機率 1/100。適合穩健型玩家。</p>
                    </div>
                    
                    <h5 class="font-bold text-stone-800 text-lg mt-4">💡 實戰攻略 (專家級)</h5>
                    <ul class="list-disc pl-5 space-y-2">
                        <li><strong>和值分析：</strong>最常見的和值為 13、14。建議鎖定 10~20 的「黃金和值區間」，涵蓋率約 70%。</li>
                        <li><strong>冷熱配比：</strong>不要全追熱號。建議 1 熱 + 2 溫 的組合最穩定。</li>
                        <li><strong>形態判斷：</strong>觀察近期是「對子 (AAB)」多還是「雜六 (ABC)」多，順勢操作。</li>
                    </ul>
                </div>
            `
        },
        '4星彩': {
            type: 'digit',
            range: 9,
            count: 4,
            desc: "從0000~9999中選號，分為正彩、組彩。",
            subModes: [
                { id: 'direct', name: '🔴 正彩', count: 4, rule: '需數字與位置完全對中' },
                { id: 'group', name: '🔵 組彩', count: 4, rule: '數字對中即可，不限位置' }
            ],
            article: `
                <div class="space-y-4 text-sm text-stone-600 leading-relaxed">
                    <h5 class="font-bold text-stone-800 text-lg">四星彩玩法規則</h5>
                    <p><strong>1. 正彩：</strong>四個數字與位置需完全相同。機率 1/10000。</p>
                    <p><strong>2. 組彩：</strong>四個數字相同即可，不限順序。含 24組彩(全異)、12組彩(一對)、6組彩(兩對)、4組彩(三同)。</p>
                </div>
            `
        }
    },
    ORDER: ['大樂透', '威力彩', '今彩539', '3星彩', '4星彩'],
    
    // 學派說明
    SCHOOLS: {
        balance: { 
            color: "border-school-balance", 
            title: "結構平衡學派", 
            desc: `<div><span class="font-bold text-school-balance block mb-1 text-sm">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">基於常態分佈理論。計算AC值(複雜度)與和值區間，排除全奇/全偶等極端組合，專攻機率最高的「黃金結構」。</p></div>` 
        },
        stat: { 
            color: "border-school-stat", 
            title: "統計學派", 
            desc: `<div><span class="font-bold text-school-stat block mb-1 text-sm">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">大數據慣性分析。加入「012路」分析與「極限遺漏」回補機制，在熱號恆熱與冷號反彈間取得最佳期望值。</p></div>` 
        },
        pattern: { 
            color: "border-school-pattern", 
            title: "關聯學派", 
            desc: `<div><span class="font-bold text-school-pattern block mb-1 text-sm">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">捕捉號碼間的隱形連結。分析上期獎號的「拖牌效應」與「尾數連動」，預測版路的下一個落點。</p></div>` 
        },
        ai: { 
            color: "border-school-ai", 
            title: "AI 學派", 
            desc: `<div><span class="font-bold text-school-ai block mb-1 text-sm">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">時間序列加權運算。針對3星彩加入「路單追蹤」(Trend Follow)，捕捉單雙/大小的連續趨勢與折返點。</p></div>` 
        },
        wuxing: {
            color: "border-school-wuxing",
            title: "五行生肖學派",
            desc: `<div><span class="font-bold text-pink-700 block mb-1 text-sm">核心策略：</span><p class="text-justify leading-relaxed text-stone-600 text-sm">AI 宗師級命理運算。將您的紫微斗數與星盤資料，結合當日天干地支與流年財位，推演專屬幸運磁場。</p></div>`
        }
    }
};
