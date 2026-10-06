import re, signal, subprocess, sys, tempfile, urllib.request, html as h

def handler(signum, frame):
    raise TimeoutError("timeout")

signal.signal(signal.SIGALRM, handler)
for line in open(sys.argv[1]):
    line = line.strip()
    if not line or line.startswith("#"):
        continue
    url, _, keywords = line.partition(" ")
    print(f"===== {url}", flush=True)
    try:
        signal.alarm(45)
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/124 Safari/537.36", "Accept-Language": "en-CA,en;q=0.9"})
        data = urllib.request.urlopen(req, timeout=40).read()
        signal.alarm(0)
        if data[:4] == b"%PDF":
            with tempfile.NamedTemporaryFile(suffix=".pdf") as f:
                f.write(data); f.flush()
                text = subprocess.run(["pdftotext", "-layout", f.name, "-"], capture_output=True, text=True).stdout
        else:
            t = data.decode("utf-8", "ignore")
            t = re.sub(r"<script.*?</script>|<style.*?</style>", "", t, flags=re.S)
            text = h.unescape(re.sub(r"<[^>]+>", " ", t))
        text = re.sub(r"[ \t]+", " ", text)
        text = re.sub(r"\n\s*\n+", "\n", text)
        if keywords:
            out = []
            for kw in keywords.split("|"):
                for m in list(re.finditer(re.escape(kw), text, re.I))[:4]:
                    out.append(text[max(0, m.start() - 400): m.start() + 900].replace("\n", " / "))
            text = "\n---\n".join(out) or "(no keyword match) " + text[:3000].replace("\n", " / ")
        else:
            text = text[:12000].replace("\n", " / ")
        for i in range(0, len(text), 3000):
            print(text[i:i + 3000], flush=True)
    except Exception as e:
        signal.alarm(0)
        print("ERROR", repr(e), flush=True)
