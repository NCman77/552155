import json
import os
import requests
import zipfile
import io
import datetime
import re
import time

# 設定
DATA_DIR = 'data'
OUTPUT_FILE = os.path.join(DATA_DIR, 'lottery-data.json')
HISTORY_YEARS = [2021, 2022, 2023, 2024, 2025]
API_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery'

# 定義遊戲與 API 代碼對照
GAMES = {
    '大樂透': 'Lotto649',
    '威力彩': 'SuperLotto638',
    '今彩539': 'DailyCash',
    '雙贏彩': 'Lotto1224',
    '3星彩': '3D',
    '4星彩': '4D'
}

# 偽裝成瀏覽器的 Header
HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.taiwanlottery.com/',
    'Origin': 'https://www.taiwanlottery.com'
}

def ensure_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def parse_csv_line(line):
    # 移除 BOM 並去除空白
    line = line.replace('\ufeff', '').strip()
    if not line: return None
    
    # 處理 CSV 引號
    cols = [c.strip().replace('"', '') for c in line.split(',')]
    if len(cols) < 5: return None # 放寬限制
    
    game_name = cols[0].strip()
    # 模糊比對遊戲名稱 (避免編碼問題導致的空白)
    matched_game = None
    for g in GAMES:
        if g in game_name:
            matched_game = g
            break
            
    if not matched_game: return None

    # 日期處理 (民國/西元)
    date_str = cols[2].strip()
    # 支援 112/1/1, 112/01/01, 112.1.1 等格式
    match = re.search(r'(\d{3,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})', date_str)
    
    final_date = ""
    if match:
        y = int(match.group(1))
        m = int(match.group(2))
        d = int(match.group(3))
        if y < 1911: y += 1911
        final_date = f"{y}-{m:02d}-{d:02d}"
    else:
        return None

    try:
        numbers = []
        # 智慧尋找數字欄位：從第6欄開始找，只要是 1~99 的數字就收錄
        for i in range(5, len(cols)): 
            val = cols[i].strip()
            if val.isdigit():
                n = int(val)
                if 0 <= n <= 99: # 合理範圍
                    numbers.append(n)
        
        # 如果號碼太少(例如只有1個)，可能是解析錯誤，跳過
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
    print("Loading history ZIPs...")
    db = {g: [] for g in GAMES}
    
    for year in HISTORY_YEARS:
        zip_path = os.path.join(DATA_DIR, f'{year}.zip')
        if not os.path.exists(zip_path):
            print(f"Skipping {zip_path} (not found)")
            continue
            
        try:
            with zipfile.ZipFile(zip_path, 'r') as z:
                for filename in z.namelist():
                    if filename.lower().endswith('.csv') and not filename.startswith('__'):
                        with z.open(filename) as f:
                            raw_content = f.read()
                            content = ""
                            # 嘗試多種編碼
                            for enc in ['cp950', 'utf-8-sig', 'utf-8', 'big5']:
                                try:
                                    content = raw_content.decode(enc)
                                    break
                                except: continue
                            
                            if not content:
                                print(f"Failed to decode {filename}")
                                continue

                            lines = content.splitlines()
                            for line in lines:
                                parsed = parse_csv_line(line)
                                if parsed:
                                    db[parsed['game']].append(parsed['data'])
                            print(f"Loaded {len(lines)} lines from {filename}")
        except Exception as e:
            print(f"Error reading {year}.zip: {e}")
            
    return db

def fetch_api(db):
    print("Fetching live API...")
    
    # 檢查目前數據量，如果太少，自動抓取更多月份 (回補機制)
    has_data = any(len(db[g]) > 0 for g in GAMES)
    fetch_months = 12 if not has_data else 3 # 沒資料抓12個月，有資料抓3個月
    
    today = datetime.date.today()
    months = []
    for i in range(fetch_months):
        d = today - datetime.timedelta(days=i*30)
        months.append(d.strftime('%Y-%m'))
    
    months = sorted(list(set(months)))
    
    for game_name, code in GAMES.items():
        existing_keys = set(f"{d['date']}_{d['period']}" for d in db[game_name])
        
        for m in months:
            url = f"{API_BASE}/{code}Result?period&month={m}&pageNum=1&pageSize=50"
            print(f"Requesting {game_name} ({m})...")
            try:
                res = requests.get(url, headers=HEADERS, timeout=30)
                if res.status_code != 200: continue
                    
                data = res.json()
                if 'content' not in data: continue
                
                # 自動尋找正確的 List Key (忽略大小寫)
                target_list = []
                for k, v in data['content'].items():
                    if isinstance(v, list) and 'ResulDtoList' in k:
                        target_list = v
                        break
                
                if not target_list: continue

                for item in target_list:
                    # 日期處理
                    date_raw = item['lotteryDate']
                    date_str = date_raw.split('T')[0] if 'T' in date_raw else date_raw
                    key = f"{date_str}_{item['period']}"
                    
                    if key not in existing_keys:
                        nums = []
                        # 智能抓取所有號碼欄位 (no1~no20, winNo1~winNo6 等)
                        for k, v in item.items():
                            # 檢查 key 是否包含 'no' 且值為數字 (排除 period, sno 等)
                            if ('no' in k.lower() or 'win' in k.lower()) and isinstance(v, int):
                                # 排除特別號 (通常是 sNo) 和期數相關
                                if k.lower() not in ['sno', 'period', 'periodno']:
                                    if v > 0: nums.append(v)
                        
                        # 補上特別號
                        if item.get('sNo'):
                            nums.append(int(item['sNo']))
                        
                        # 去重並排序 (有些 API 會重複欄位)
                        # nums = sorted(list(set(nums))) # 不排序，保留開出順序
                        
                        if len(nums) > 0:
                            db[game_name].append({
                                'date': date_str,
                                'period': item['period'],
                                'numbers': nums,
                                'source': 'api'
                            })
                            existing_keys.add(key)
                
                time.sleep(0.2) # 禮貌性延遲
                
            except Exception as e:
                print(f"API Error ({game_name} {m}): {e}")

def save_data(db):
    print("Saving data...")
    count = 0
    for game in db:
        db[game].sort(key=lambda x: x['date'], reverse=True)
        count += len(db[game])
        print(f"Game {game}: {len(db[game])} records")
        
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(db, f, ensure_ascii=False, separators=(',', ':'))
        print(f"Successfully saved {count} records to {OUTPUT_FILE}")
    except Exception as e:
        print(f"Error saving file: {e}")

def main():
    try:
        ensure_dir()
        db = load_history()
        fetch_api(db)
        save_data(db)
    except Exception as e:
        print(f"Critical Error: {e}")
        if not os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump({}, f)

if __name__ == '__main__':
    main()
