import html, re, subprocess, sys
path, kind = sys.argv[1], sys.argv[2]
pattern = sys.argv[3] if len(sys.argv) > 3 else ""
context = int(sys.argv[4]) if len(sys.argv) > 4 and sys.argv[4] else 0
if kind == "pdf":
    text = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout
else:
    raw = open(path, "rb").read()
    s = None
    for enc in ("utf-8", "cp1252", "latin-1"):
        try:
            s = raw.decode(enc); break
        except UnicodeDecodeError:
            continue
    s = re.sub(r"(?is)<(script|style)[^>]*>.*?</\1>", " ", s)
    s = re.sub(r"(?i)<br\s*/?>|</(p|div|tr|li|h\d|table)>", "\n", s)
    s = re.sub(r"(?i)</t[dh]>", " | ", s)
    s = re.sub(r"<[^>]+>", " ", s)
    text = html.unescape(s)
lines = [re.sub(r"[ \t\xa0]+", " ", l).strip() for l in text.splitlines()]
lines = [l for l in lines if l]
print(f"lines: {len(lines)}")
if not pattern:
    print("\n".join(lines[:600])); sys.exit()
rx = re.compile(pattern, re.I)
keep = set()
for i, l in enumerate(lines):
    if rx.search(l):
        keep.update(range(max(0, i - 2), min(len(lines), i + context + 1)))
prev = -2
for i in sorted(keep)[:1500]:
    if i != prev + 1: print("-----")
    print(lines[i]); prev = i
