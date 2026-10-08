import io, urllib.request, sys
keys = ["New York-Newark", "Los Angeles-Long Beach", "San Francisco", "San Jose-Sunnyvale", "San Diego", "Seattle-Bellevue", "Chicago-Joliet", "Boston-Cambridge", "Washington-Arlington", "Dallas, TX", "Houston-The Woodlands", "Austin-Round Rock", "Miami-Miami Beach", "Miami-Dade"]
for url in ["https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY26_FMRs.xlsx", "https://www.huduser.gov/portal/datasets/fmr/fmr2026/FY26_FMRs_revised.xlsx"]:
    try:
        data = urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0"}), timeout=60).read()
    except Exception as e:
        print("ERR", url, e); continue
    print("URL", url, len(data), data[:8], flush=True)
    rows = []
    if data[:2] == b"PK":
        import openpyxl
        wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True)
        for ws in wb.worksheets:
            rows += [r for r in ws.iter_rows(values_only=True)]
    elif data[:4] == bytes.fromhex("D0CF11E0"):
        import xlrd
        wb = xlrd.open_workbook(file_contents=data)
        for sh in wb.sheets():
            rows += [sh.row_values(i) for i in range(sh.nrows)]
    else:
        print(data[:1500].decode("utf-8", "ignore")); continue
    print("HEADER", rows[0], flush=True)
    seen = set()
    for r in rows[1:]:
        text = " | ".join(str(c) for c in r if c not in (None, ""))
        if any(k in text for k in keys) and text[:120] not in seen:
            seen.add(text[:120]); print("ROW", text[:500], flush=True)
