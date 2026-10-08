import io, urllib.request, openpyxl, sys
url = "https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY26_FMRs.xlsx"
data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True)
for ws in wb.worksheets:
    rows = ws.iter_rows(values_only=True)
    header = next(rows)
    print("SHEET", ws.title, header, flush=True)
    keys = ["New York-Newark", "Los Angeles-Long Beach", "San Francisco", "San Jose-Sunnyvale", "San Diego", "Seattle-Bellevue", "Chicago-Joliet", "Boston-Cambridge", "Washington-Arlington", "Dallas, TX", "Houston-The Woodlands", "Austin-Round Rock", "Miami-Miami Beach", "Miami-Dade"]
    seen = set()
    for r in rows:
        text = " | ".join(str(c) for c in r if c is not None)
        for k in keys:
            if k in text and (k, text[:80]) not in seen:
                seen.add((k, text[:80]))
                print("ROW", text[:400], flush=True)
