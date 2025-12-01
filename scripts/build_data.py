import json
import os
import requests
import zipfile
import io
import datetime
import re
import time

# === 設定區 ===
DATA_DIR = 'data'
OUTPUT_FILE = os.path.join(DATA_DIR, 'lottery-data.json')
HISTORY_YEARS = [2021, 2022, 2023, 2024, 2025]
API_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery'

# 遊戲代碼對照表 (Key: 顯示名稱, Value: API代碼)
GAMES = {
    '大樂透': 'Lotto649',
    '威力彩': 'SuperLotto638',
    '今彩539': 'Daily539',
    '雙贏彩': 'Lotto1224',
    '3星彩': '3D',
    '4星彩': '4D'
}

# 頭獎爬蟲目標網址
JACKPOT_URLS = {
    '大樂透': 'https://www.taiwanlottery.com/lotto/result/lotto649',
    '威力彩': 'https://www.taiwanlottery.com/lotto/result/super_lotto638'
}

# 瀏覽器偽裝標頭 (解決 API 阻擋問題)
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'zh-TW,zh;q=0.9,en-US;q=0.8,en;q=0.7',
    'Referer': 'https://www.taiwanlottery.com/',
    'Origin': 'https://www.taiwanlottery.com'
}

def ensure_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def get_jackpot_amount(game_name):
    """ 從網頁 HTML 爬取目前頭獎累積金額 """
    if game_name not in JACKPOT_URLS:
        return None
    
    url = JACKPOT_URLS[game_name]
    print(f"Scraping jackpot for {game_name}...")
    try:
        res = requests.get(url, headers=HEADERS, timeout=15)
        if res.status_code != 200: 
            print(f"Jackpot page fetch failed: {res.status_code}")
            return None
        
        # 針對您提供的 HTML 結構進行正則匹配
        # 尋找 <div ... class="amount-number" ...>數字</div>
        matches = re.findall(r'class="amount-number"[^>]*>(\d)</div>', res.text)
        
        if matches:
            amount_str = "".join(matches)
            formatted = "{:,}".format(int(amount_str))
            print(f"Found Jackpot: {formatted}")
            return formatted
        
        if "更新中" in res.text:
            return "更新中"
            
        return None
    except Exception as e:
        print(f"Jackpot scrape error: {e}")
        return None

def parse_csv_line(line):
    """ 解析歷史 ZIP 檔中的 CSV 行 """
    line = line.replace('\ufeff', '').strip()
    if not line: return None
    
    cols = [c.strip().replace('"', '') for c in line.split(',')]
    if len(cols) < 5: return None
    
    # 判斷遊戲名稱
    game_name = cols[0].strip()
    matched_game = None
    for g in GAMES:
        if g in game_name:
            matched_game = g
            break
    if not matched_game: return None

    # 日期解析 (支援 112/1/1, 112-01-01 等格式)
    date_str = cols[2].strip()
    match = re.search(r'(\d{3,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})', date_str)
    
    final_date = ""
    if match:
        y = int(match.group(1))
        m = int(match.group(2))
        d = int(match.group(3))
        if y < 1911: y += 1911 # 民國轉西元
        final_date = f"{y}-{m:02d}-{d:02d}"
    else:
        return None

    try:
        numbers = []
        # 智能尋找獎號：從第6欄開始，只要是1-99的數字就納入
        for i in range(5, len(cols)): 
            val = cols[i].strip()
            if val.isdigit():
                n = int(val)
                if 0 <= n <= 99:
                    numbers.append(n)
        
        # 資料完整性檢查
        if len(numbers) < 2: return None

        return {
            'game': matched_game,
            'data': {
                'date': final_date,
                'period': cols[1],
                'numbers': numbers, 
                'source': 'history'
            }
        }
    except:
        return None

def load_history():
    """ 載入所有 ZIP 歷史資料 """
    print("=== Loading History ZIPs ===")
    db = {g: [] for g in GAMES}
    
    for year in HISTORY_YEARS:
        zip_path = os.path.join(DATA_DIR, f'{year}.zip')
        if not os.path.exists(zip_path): 
            print(f"Skipping {year}.zip (Not Found)")
            continue
            
        try:
            with zipfile.ZipFile(zip_path, 'r') as z:
                for filename in z.namelist():
                    if filename.lower().endswith('.csv') and not filename.startswith('__'):
                        with z.open(filename) as f:
                            raw = f.read()
                            content = ""
                            # 自動嘗試多種編碼，解決亂碼問題
                            for enc in ['cp950', 'utf-8-sig', 'utf-8', 'big5']:
                                try:
                                    content = raw.decode(enc)
                                    break
                                except: continue
                            
                            if content:
                                lines = content.splitlines()
                                count = 0
                                for line in lines:
                                    parsed = parse_csv_line(line)
                                    if parsed:
                                        db[parsed['game']].append(parsed['data'])
                                        count += 1
                                print(f"  Loaded {count} rows from {filename} ({year})")
        except Exception as e:
            print(f"Error reading {year}.zip: {e}")
    return db

def fetch_api(db):
    """ 從台彩 API 抓取最新資料 """
    print("=== Fetching Live API ===")
    
    # 決定要抓幾個月：如果歷史資料很少，就抓過去12個月補齊；否則只抓近3個月
    has_data = any(len(db[g]) > 0 for g in GAMES)
    fetch_months = 12 if not has_data else 3
    
    today = datetime.date.today()
    months = []
    for i in range(fetch_months):
        d = today - datetime.timedelta(days=i*30)
        months.append(d.strftime('%Y-%m'))
    
    # 去重並排序月份
    months = sorted(list(set(months)))
    print(f"Target months: {months}")
    
    for game_name, code in GAMES.items():
        existing_keys = set(f"{d['date']}_{d['period']}" for d in db[game_name])
        print(f"Processing {game_name}...")
        
        for m in months:
            url = f"{API_BASE}/{code}Result?period&month={m}&pageNum=1&pageSize=50"
            try:
                res = requests.get(url, headers=HEADERS, timeout=30)
                if res.status_code != 200:
                    print(f"  [API Fail] {url} -> {res.status_code}")
                    continue
                
                # 安全解析 JSON
                try:
                    data = res.json()
                except:
                    print(f"  [API Error] Not a JSON response for {m}")
                    continue

                if 'content' not in data: continue
                
                # 模糊搜尋列表 Key (解決大小寫不一致問題, e.g. daily539ResulDtoList)
                target_list = []
                for k, v in data['content'].items():
                    # 只要 key 包含 'ResulDtoList' 且 value 是陣列，就當作是目標
                    if isinstance(v, list) and 'ResulDtoList' in k:
                        target_list = v
                        break
                
                if not target_list:
                    print(f"  [Info] No data list found in response for {m}")
                    continue

                new_count = 0
                for item in target_list:
                    # 處理日期格式
                    date_raw = item['lotteryDate']
                    date_str = date_raw.split('T')[0] if 'T' in date_raw else date_raw
                    key = f"{date_str}_{item['period']}"
                    
                    if key not in existing_keys:
                        nums = []
                        # 智能抓取所有號碼欄位
                        for k, v in item.items():
                            # 欄位名包含 no 或 win，且值為整數
                            if ('no' in k.lower() or 'win' in k.lower()) and isinstance(v, int):
                                # 排除 sno (特別號) 和 period (期數)
                                if k.lower() not in ['sno', 'period', 'periodno', 'superno']:
                                    if v > 0: nums.append(v)
                        
                        # 特別號另外抓
                        if item.get('sNo'): nums.append(int(item['sNo']))
                        
                        if len(nums) > 0:
                            db[game_name].append({
                                'date': date_str,
                                'period': item['period'],
                                'numbers': nums,
                                'source': 'api'
                            })
                            existing_keys.add(key)
                            new_count += 1
                
                if new_count > 0:
                    print(f"  + Added {new_count} new records for {m}")
                
                time.sleep(0.5) # 避免請求過快
            except Exception as e:
                print(f"  [Exception] {game_name} {m}: {e}")

def save_data(db):
    """ 整合並儲存資料 """
    print("=== Saving Data ===")
    jackpots = {}
    
    # 抓取頭獎金額
    for game in JACKPOT_URLS:
        amount = get_jackpot_amount(game)
        if amount:
            jackpots[game] = amount

    # 排序資料
    total_records = 0
    for game in db:
        # 按日期降序排列 (最新的在前面)
        db[game].sort(key=lambda x: x['date'], reverse=True)
        total_records += len(db[game])
        
    final_output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "jackpots": jackpots,
        "games": db
    }
        
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, ensure_ascii=False, separators=(',', ':'))
        print(f"✅ Successfully saved {total_records} records to {OUTPUT_FILE}")
    except Exception as e:
        print(f"❌ Error saving file: {e}")

def main():
    try:
        ensure_dir()
        db = load_history()
        fetch_api(db)
        save_data(db)
    except Exception as e:
        print(f"❌ Critical Error: {e}")
        # 災難恢復：建立空檔案避免前端報錯
        if not os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump({"games":{}, "jackpots":{}}, f)

if __name__ == '__main__':
    main()
