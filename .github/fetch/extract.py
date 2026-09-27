import html, re, subprocess, sys
path, kind = sys.argv[1], sys.argv[2]
if kind == "pdf":
    text = subprocess.run(["pdftotext", "-layout", path, "-"], capture_output=True, text=True).stdout
else:
    raw = open(path, "rb").read()
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
print("\n".join(l for l in lines if l))
