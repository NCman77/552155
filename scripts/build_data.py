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
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
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
    cols = [c.strip().replace('"', '') for c in line.split(',')]
    if len(cols) < 8: return None
    
    game_name = cols[0]
    if game_name not in GAMES: return None

    # 日期處理 (民國/西元)
    date_str = cols[2]
    match = re.match(r'^(\d{3,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})$', date_str)
    if not match: return None
    
    y = int(match.group(1))
    if y < 1911: y += 1911
    final_date = f"{y}-{int(match.group(2)):02d}-{int(match.group(3)):02d}"

    try:
        numbers = []
        # 大部分的獎號在 6-11 欄
        for i in range(6, len(cols)): 
            if cols[i].isdigit():
                numbers.append(int(cols[i]))
        
        return {
            'game': game_name,
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
                            # 嘗試使用 cp950 (Big5) 解碼
                            content = f.read().decode('cp950', errors='ignore')
                            lines = content.splitlines()
                            for line in lines:
                                if not line.strip(): continue
                                parsed = parse_csv_line(line)
                                if parsed:
                                    db[parsed['game']].append(parsed['data'])
        except Exception as e:
            print(f"Error reading {year}.zip: {e}")
            
    return db

def fetch_api(db):
    print("Fetching live API...")
    # 抓取最近 3 個月 (確保覆蓋)
    today = datetime.date.today()
    months = []
    for i in range(3):
        d = today - datetime.timedelta(days=i*30)
        months.append(d.strftime('%Y-%m'))
    
    months = sorted(list(set(months)))
    
    for game_name, code in GAMES.items():
        # 建立現有資料的 Key 集合以避免重複
        existing_keys = set(f"{d['date']}_{d['period']}" for d in db[game_name])
        
        for m in months:
            url = f"{API_BASE}/{code}Result?period&month={m}&pageNum=1&pageSize=50"
            print(f"Requesting {game_name} ({m})...")
            try:
                res = requests.get(url, headers=HEADERS, timeout=30)
                if res.status_code != 200:
                    print(f"Failed {url}: {res.status_code}")
                    continue
                    
                data = res.json()
                # API 回傳結構檢查
                content_key = f'{code.lower()}ResulDtoList'
                # 有些 API 回傳 key 可能略有不同，這裡可以加強判斷，但目前台彩規則一致
                
                if 'content' in data and content_key in data['content']:
                    for item in data['content'][content_key]:
                        # 日期處理
                        date_raw = item['lotteryDate']
                        date_str = date_raw.split('T')[0] if 'T' in date_raw else date_raw
                        key = f"{date_str}_{item['period']}"
                        
                        if key not in existing_keys:
                            nums = []
                            # 一般號 (no1 ~ no20)
                            for i in range(1, 21):
                                k = f'no{i}'
                                if item.get(k):
                                    try:
                                        nums.append(int(item[k]))
                                    except: pass
                            
                            # 特別號
                            if item.get('sNo'):
                                try:
                                    nums.append(int(item['sNo']))
                                except: pass

                            db[game_name].append({
                                'date': date_str,
                                'period': item['period'],
                                'numbers': nums,
                                'source': 'api'
                            })
                            existing_keys.add(key)
                
                # 避免請求太快被擋
                time.sleep(0.5)
                
            except Exception as e:
                print(f"API Error ({game_name} {m}): {e}")

def save_data(db):
    # 排序與儲存
    print("Saving data...")
    count = 0
    for game in db:
        # 按日期降序
        db[game].sort(key=lambda x: x['date'], reverse=True)
        count += len(db[game])
        
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
        print(f"Critical Error in main: {e}")
        # 即使失敗，也要嘗試建立一個空檔案，避免前端 404
        if not os.path.exists(OUTPUT_FILE):
            print("Creating empty backup file...")
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump({}, f)

if __name__ == '__main__':
    main()
