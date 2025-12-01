import json
import os
import requests
import zipfile
import io
import datetime
import re
import time
import urllib3

# 關閉 SSL 警告
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

# === 設定區 ===
DATA_DIR = 'data'
OUTPUT_FILE = os.path.join(DATA_DIR, 'lottery-data.json')
HISTORY_YEARS = [2021, 2022, 2023, 2024, 2025]
API_BASE = 'https://api.taiwanlottery.com/TLCAPIWeB/Lottery'

# 遊戲代碼對照表 (修正 3星/4星彩代碼)
GAMES = {
    '大樂透': 'Lotto649',
    '威力彩': 'SuperLotto638',
    '今彩539': 'Daily539',
    '3星彩': 'Lotto3D',  # 修正：3D -> Lotto3D
    '4星彩': 'Lotto4D'   # 修正：4D -> Lotto4D
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
    """ 生成過去4個月和未來12個月的月份列表 """
    today = datetime.date.today()
    months = []
    
    # 過去4個月 (包含本月)
    for i in range(4):
        month = today.month - i
        year = today.year
        if month <= 0:
            month += 12
            year -= 1
        months.append(f"{year}-{month:02d}")
    
    # 未來12個月 (從下個月開始)
    for i in range(1, 13):
        month = today.month + i
        year = today.year
        if month > 12:
            month -= 12
            year += 1
        months.append(f"{year}-{month:02d}")
    
    # 移除重複並排序
    return sorted(list(set(months)))

def get_jackpot_amount(game_name):
    """ 從網頁 HTML 爬取目前頭獎累積金額 """
    if game_name not in JACKPOT_URLS: return None
    url = JACKPOT_URLS[game_name]
    print(f"Scraping jackpot for {game_name}...")
    try:
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
    # 模糊比對遊戲名稱 (因為 CSV 內的名稱可能與 key 不完全相同)
    for g_key, g_code in GAMES.items():
        if g_key in game_name:
            matched_game = g_key
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
                # 3星/4星彩號碼可為0，其他遊戲通常大於0
                if 0 <= n <= 99: numbers.append(n)
        
        # 3星彩至少3碼，其他至少2碼
        min_len = 3 if matched_game in ['3星彩', '4星彩'] else 2
        if len(numbers) < min_len: return None
        
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
    print(f"Target months: {len(months)} months")
    
    for game_name, code in GAMES.items():
        existing_keys = set(f"{d['date']}_{d['period']}" for d in db[game_name])
        print(f"Processing {game_name} ({code})...")
        
        for m in months:
            # 修正：移除 period 參數，這才是能抓到資料的關鍵
            url = f"{API_BASE}/{code}Result?month={m}&pageNum=1&pageSize=50"
            try:
                res = requests.get(url, headers=HEADERS, timeout=30, verify=False)
                if res.status_code != 200:
                    print(f"  [Fail] {m} -> {res.status_code}")
                    continue
                
                try: data = res.json()
                except: continue

                if 'content' not in data: continue
                
                target_list = []
                # 模糊搜尋 List Key (例如 lotto649ResulDtoList, daily539ResulDtoList)
                for k, v in data['content'].items():
                    if isinstance(v, list) and 'ResulDtoList' in k:
                        target_list = v
                        break
                
                if not target_list: continue

                count = 0
                for item in target_list:
                    date_raw = item.get('lotteryDate', '')
                    date_str = date_raw.split('T')[0] if 'T' in date_raw else date_raw
                    if not date_str: continue

                    key = f"{date_str}_{item.get('period')}"
                    
                    if key not in existing_keys:
                        nums = []
                        # 智能抓取號碼 (no1~no20, winNo1~winNo6)
                        for k, v in item.items():
                            if ('no' in k.lower() or 'win' in k.lower()) and isinstance(v, int):
                                # 3星/4星彩沒有 sno，其他遊戲排除 sno
                                if k.lower() not in ['sno', 'period', 'periodno', 'superno']:
                                    # 3星/4星彩允許 0
                                    if v >= 0: nums.append(v)
                        
                        # 補特別號 (3星/4星除外)
                        if item.get('sNo') is not None and int(item.get('sNo')) > 0:
                             nums.append(int(item['sNo']))
                        
                        # 3星/4星彩不需要去重排序，其他遊戲可保持原序
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
                time.sleep(0.3)
            except Exception as e:
                print(f"  [Error] {game_name} {m}: {e}")

def save_data(db):
    print("=== Saving Data ===")
    jackpots = {}
    
    # 抓取頭獎
    for game in JACKPOT_URLS:
        amt = get_jackpot_amount(game)
        if amt: jackpots[game] = amt

    total_records = 0
    for game in db:
        # 按日期降序
        db[game].sort(key=lambda x: x['date'], reverse=True)
        total_records += len(db[game])
        print(f"  {game}: {len(db[game])}")
        
    final_output = {
        "last_updated": datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
        "total_records": total_records,
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
        print(f"Critical: {e}")
        if not os.path.exists(OUTPUT_FILE):
            with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
                json.dump({"games":{}, "jackpots":{}}, f)

if __name__ == '__main__':
    main()
