"""Fetch official tax pages and print their visible text to the job log (temporary helper, not merged)."""
import html.parser, io, sys, urllib.request

class Text(html.parser.HTMLParser):
    def __init__(self):
        super().__init__(); self.parts = []; self.skip = 0
    def handle_starttag(self, tag, attrs):
        if tag in ("script", "style", "noscript"): self.skip += 1
        if tag in ("tr", "p", "br", "li", "h1", "h2", "h3", "h4", "div"): self.parts.append("\n")
        if tag in ("td", "th"): self.parts.append(" | ")
    def handle_endtag(self, tag):
        if tag in ("script", "style", "noscript"): self.skip -= 1
    def handle_data(self, data):
        if not self.skip: self.parts.append(data)

for url in [line.strip() for line in open(sys.argv[1]) if line.strip() and not line.startswith("#")]:
    print(f"\n===== BEGIN {url}")
    try:
        req = urllib.request.Request(url, headers={"User-Agent": "Mozilla/5.0 (LifeAtlas source check)"})
        body = urllib.request.urlopen(req, timeout=60).read()
        if url.lower().endswith(".pdf") or body[:4] == b"%PDF":
            from pypdf import PdfReader
            text = "\n".join(page.extract_text() or "" for page in PdfReader(io.BytesIO(body)).pages)
        else:
            parser = Text(); parser.feed(body.decode("utf-8", "replace")); text = "".join(parser.parts)
        lines = [" ".join(line.split()) for line in text.splitlines()]
        # ナビゲーションの短い行を除き、残りを約3,000字ごとの行にまとめてログの行数を抑えます。
        kept = " / ".join(line for line in lines if line and (len(line) > 25 or any(ch.isdigit() for ch in line)))[:40000]
        print("\n".join(kept[i:i + 3000] for i in range(0, len(kept), 3000)))
    except Exception as error:
        print(f"FETCH FAILED: {error!r}")
    print(f"===== END {url}")
