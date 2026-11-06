"""Build a local, ignored design snapshot from existing AI data. No external data download."""
import json
from pathlib import Path
from urllib.request import urlopen

import pandas as pd

root = Path(__file__).resolve().parents[1]
data = pd.read_parquet(root.parent / 'HUFS-Histock-AI/data/raw/price_SPY.parquet')
with urlopen('http://127.0.0.1:8080/api/v1/analysis/health', timeout=10) as response:
    health = json.load(response)
date = health['date_end']
with urlopen(f'http://127.0.0.1:8080/api/v1/analysis/search?date={date}&method=hybrid&cases=5&explain=true', timeout=70) as response:
    analysis = json.load(response)
windows = [data.loc[:date].tail(240)]
for case in analysis['cases']:
    window = data.loc[:case['date']].tail(20)
    assert len(window) == 20 and str(window.index[-1].date()) == case['date']
    windows.append(window)
prices = pd.concat(windows)
prices = prices[~prices.index.duplicated()].sort_index().reset_index()
prices['date'] = prices['date'].dt.strftime('%Y-%m-%d')
payload = {'analysis': analysis, 'prices': prices.to_dict(orient='records'), 'dataDate': date,
           'source': '로컬 AI 데이터 · yfinance · 배당·분할 보정 OHLCV · 실시간 아님'}
target = root / 'public/snapshot.json'
target.parent.mkdir(exist_ok=True)
target.write_text(json.dumps(payload, ensure_ascii=False, allow_nan=False), encoding='utf-8')
print(f'저장본 생성: {date}, {len(prices)}개 일봉 → {target}')
