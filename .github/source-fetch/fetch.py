import io, re, sys, urllib.request

UA = {"User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 14_5) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15"}

def get(url):
    return urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=150).read()

for line in open(sys.argv[1]):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    mode, url, *rest = line.split(" ")
    print(f"===== {mode} {url}", flush=True)
    try:
        data = get(url)
        if mode == "LINKS":
            t = data.decode("utf-8", "ignore")
            for href in sorted(set(re.findall(r'href="([^"]+\.(?:xlsx|xls|csv)[^"]*)"', t, re.I))):
                print(href)
        elif mode == "XLSX":
            import openpyxl
            pattern = re.compile(rest[0], re.I) if rest else None
            wb = openpyxl.load_workbook(io.BytesIO(data), read_only=True, data_only=True)
            for ws in wb.worksheets:
                print("## sheet", ws.title, flush=True)
                for i, row in enumerate(ws.iter_rows(values_only=True)):
                    cells = [str(c) for c in row if c is not None]
                    text = " | ".join(cells)
                    if i < 8 or (pattern and pattern.search(text)):
                        print(i, text[:400])
        print(flush=True)
    except Exception as e:
        print("ERROR", repr(e), flush=True)
