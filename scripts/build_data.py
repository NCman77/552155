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
    '今彩539': 'Daily539',  # 修正：DailyCash -> Daily539
    '雙贏彩': 'Lotto1224',
    '3星彩': '3D',
    '4星彩': '4D'
}

# 頭獎爬蟲網址
JACKPOT_URLS = {
    '大樂透': 'https://www.taiwanlottery.com/lotto/result/lotto649',
    '威力彩': 'https://www.taiwanlottery.com/lotto/result/super_lotto638'
}

HEADERS = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
    'Accept': 'application/json, text/plain, */*',
    'Referer': 'https://www.taiwanlottery.com/',
    'Origin': 'https://www.taiwanlottery.com'
}

def ensure_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def get_jackpot_amount(game_name):
    if game_name not in JACKPOT_URLS:
        return None
    
    url = JACKPOT_URLS[game_name]
    print(f"Scraping jackpot for {game_name}...")
    try:
        res = requests.get(url, headers=HEADERS, timeout=10)
        if res.status_code != 200: return None
        
        # 尋找 <div ... class="amount-number" ...>0</div> 結構
        # 將找到的所有數字串接起來
        matches = re.findall(r'class="amount-number"[^>]*>(\d)</div>', res.text)
        if matches:
            amount_str = "".join(matches)
            # 格式化為貨幣 (e.g. 100,000,000)
            return "{:,}".format(int(amount_str))
        
        # 如果顯示 "更新中" 或其他文字
        if "更新中" in res.text:
            return "更新中"
            
        return None
    except Exception as e:
        print(f"Jackpot scrape error: {e}")
        return None

def parse_csv_line(line):
    line = line.replace('\ufeff', '').strip()
    if not line: return None
    cols = [c.strip().replace('"', '') for c in line.split(',')]
    if len(cols) < 5: return None
    
    game_name = cols[0].strip()
    matched_game = None
    for g in GAMES:
        if g in game_name:
            matched_game = g
            break
    if not matched_game: return None

    date_str = cols[2].strip()
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
        for i in range(5, len(cols)): 
            val = cols[i].strip()
            if val.isdigit():
                n = int(val)
                if 0 <= n <= 99:
                    numbers.append(n)
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
        if not os.path.exists(zip_path): continue
            
        try:
            with zipfile.ZipFile(zip_path, 'r') as z:
                for filename in z.namelist():
                    if filename.lower().endswith('.csv') and not filename.startswith('__'):
                        with z.open(filename) as f:
                            raw = f.read()
                            content = ""
                            for enc in ['cp950', 'utf-8-sig', 'utf-8', 'big5']:
                                try:
                                    content = raw.decode(enc)
                                    break
                                except: continue
                            
                            if content:
                                for line in content.splitlines():
                                    parsed = parse_csv_line(line)
                                    if parsed:
                                        db[parsed['game']].append(parsed['data'])
        except Exception as e:
            print(f"Error reading {year}.zip: {e}")
    return db

def fetch_api(db):
    print("Fetching live API...")
    has_data = any(len(db[g]) > 0 for g in GAMES)
    fetch_months = 12 if not has_data else 3
    
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
            try:
                res = requests.get(url, headers=HEADERS, timeout=30)
                if res.status_code != 200: continue
                data = res.json()
                if 'content' not in data: continue
                
                target_list = []
                # 模糊搜尋 List Key (e.g. daily539ResulDtoList)
                for k, v in data['content'].items():
                    if isinstance(v, list) and 'ResulDtoList' in k:
                        target_list = v
                        break
                
                if not target_list: continue

                for item in target_list:
                    date_raw = item['lotteryDate']
                    date_str = date_raw.split('T')[0] if 'T' in date_raw else date_raw
                    key = f"{date_str}_{item['period']}"
                    
                    if key not in existing_keys:
                        nums = []
                        for k, v in item.items():
                            if ('no' in k.lower() or 'win' in k.lower()) and isinstance(v, int):
                                if k.lower() not in ['sno', 'period', 'periodno']:
                                    if v > 0: nums.append(v)
                        
                        if item.get('sNo'): nums.append(int(item['sNo']))
                        
                        if len(nums) > 0:
                            db[game_name].append({
                                'date': date_str,
                                'period': item['period'],
                                'numbers': nums,
                                'source': 'api'
                            })
                            existing_keys.add(key)
                time.sleep(0.2)
            except Exception as e:
                print(f"API Error ({game_name} {m}): {e}")

def save_data(db):
    print("Saving data...")
    jackpots = {}
    
    # 抓取頭獎
    for game in JACKPOT_URLS:
        amount = get_jackpot_amount(game)
        if amount:
            jackpots[game] = amount
            print(f"{game} Jackpot: {amount}")

    for game in db:
        db[game].sort(key=lambda x: x['date'], reverse=True)
        
    final_output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "jackpots": jackpots,
        "games": db
    }
        
    try:
        with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
            json.dump(final_output, f, ensure_ascii=False, separators=(',', ':'))
        print(f"Successfully saved to {OUTPUT_FILE}")
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
                json.dump({"games":{}}, f)

if __name__ == '__main__':
    main()
