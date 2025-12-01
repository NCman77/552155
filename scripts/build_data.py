import json
import os
import requests
import zipfile
import io
import datetime
import re
import time
import urllib3

# 關閉 SSL 警告 (因為我們會用 verify=False 來確保連線成功)
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === 設定區 ===
DATA_DIR = 'data'
OUTPUT_FILE = os.path.join(DATA_DIR, 'lottery-data.json')
HISTORY_YEARS = [2021, 2022, 2023, 2024, 2025]
API_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery'

# 遊戲代碼對照表
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

# 使用您測試成功的 Header
HEADERS = {
    'User-Agent': 'Mozilla/5.0',
    'Referer': 'https://www.taiwanlottery.com/'
}

def ensure_dir():
    if not os.path.exists(DATA_DIR):
        os.makedirs(DATA_DIR)

def get_target_months():
    """ 精確生成最近 4 個月的月份列表 (避免日期計算誤差) """
    today = datetime.date.today()
    months = []
    # 往回推 4 個月 (含本月)
    for i in range(4):
        # 簡單的月份減法邏輯
        month = today.month - i
        year = today.year
        if month <= 0:
            month += 12
            year -= 1
        months.append(f"{year}-{month:02d}")
    return sorted(list(set(months)))

def get_jackpot_amount(game_name):
    """ 從網頁 HTML 爬取目前頭獎累積金額 """
    if game_name not in JACKPOT_URLS: return None
    url = JACKPOT_URLS[game_name]
    print(f"Scraping jackpot for {game_name}...")
    try:
        # 使用 verify=False 避免 SSL 錯誤
        res = requests.get(url, headers=HEADERS, timeout=20, verify=False)
        if res.status_code != 200: return None
        matches = re.findall(r'class="amount-number"[^>]*>(\d)</div>', res.text)
        if matches:
            return "{:,}".format(int("".join(matches)))
        return "更新中" if "更新中" in res.text else None
    except Exception as e:
        print(f"Jackpot error: {e}")
        return None

def parse_csv_line(line):
    """ 解析歷史 ZIP 檔 """
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

    # 日期解析
    match = re.search(r'(\d{3,4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})', cols[2].strip())
    final_date = ""
    if match:
        y, m, d = int(match.group(1)), int(match.group(2)), int(match.group(3))
        if y < 1911: y += 1911
        final_date = f"{y}-{m:02d}-{d:02d}"
    else: return None

    try:
        numbers = []
        for i in range(5, len(cols)): 
            val = cols[i].strip()
            if val.isdigit():
                n = int(val)
                if 0 <= n <= 99: numbers.append(n)
        if len(numbers) < 2: return None
        return {'game': matched_game, 'data': {'date': final_date, 'period': cols[1], 'numbers': numbers, 'source': 'history'}}
    except: return None

def load_history():
    print("=== Loading History ZIPs ===")
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
                                try: content = raw.decode(enc); break
                                except: continue
                            if content:
                                for line in content.splitlines():
                                    parsed = parse_csv_line(line)
                                    if parsed: db[parsed['game']].append(parsed['data'])
        except Exception as e: print(f"Error reading {year}.zip: {e}")
    return db

def fetch_api(db):
    print("=== Fetching Live API ===")
    months = get_target_months()
    print(f"Target months: {months}")
    
    for game_name, code in GAMES.items():
        existing_keys = set(f"{d['date']}_{d['period']}" for d in db[game_name])
        print(f"Processing {game_name} ({code})...")
        
        for m in months:
            # 使用您驗證過的正確 URL 格式
            url = f"{API_BASE}/{code}Result?month={m}&pageNum=1&pageSize=50"
            try:
                # 關鍵：verify=False 忽略 SSL 憑證問題
                res = requests.get(url, headers=HEADERS, timeout=30, verify=False)
                
                if res.status_code != 200:
                    print(f"  [Fail] {url} -> {res.status_code}")
                    continue
                
                try: data = res.json()
                except: continue

                if 'content' not in data: continue
                
                target_list = []
                for k, v in data['content'].items():
                    if isinstance(v, list) and 'ResulDtoList' in k:
                        target_list = v
                        break
                
                if not target_list: continue

                count = 0
                for item in target_list:
                    date_raw = item['lotteryDate']
                    date_str = date_raw.split('T')[0] if 'T' in date_raw else date_raw
                    key = f"{date_str}_{item['period']}"
                    
                    if key not in existing_keys:
                        nums = []
                        for k, v in item.items():
                            if ('no' in k.lower() or 'win' in k.lower()) and isinstance(v, int):
                                if k.lower() not in ['sno', 'period', 'periodno', 'superno']:
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
                            count += 1
                
                if count > 0: print(f"  + API: Found {count} new records in {m}")
                time.sleep(0.2)
            except Exception as e:
                print(f"  [Error] {game_name} {m}: {e}")

def save_data(db):
    print("=== Saving Data ===")
    jackpots = {}
    for game in JACKPOT_URLS:
        amt = get_jackpot_amount(game)
        if amt: jackpots[game] = amt

    for game in db:
        db[game].sort(key=lambda x: x['date'], reverse=True)
        
    final_output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "jackpots": jackpots,
        "games": db
    }
        
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(final_output, f, ensure_ascii=False, separators=(',', ':'))
    print(f"Saved to {OUTPUT_FILE}")

def main():
    try:
        ensure_dir()
        db = load_history()
        fetch_api(db)
        save_data(db)
    except Exception as e:
        print(f"Critical: {e}")
        if not os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump({"games":{}, "jackpots":{}}, f)

if __name__ == '__main__':
    main()
