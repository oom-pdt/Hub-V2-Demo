"""Inline the stylesheet and every src/ script into one self-contained HTML file.

Reads index.html, replaces the <!-- build:css --> and <!-- build:js --> blocks with inline
<style>/<script> tags (scripts keep the order listed in index.html), and writes
standalone.html plus dist/index.html.
"""
import os
import re

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def read(rel):
    with open(os.path.join(BASE, rel), encoding='utf-8') as f:
        return f.read()


def build():
    html = read('index.html')

    css_block = re.search(r'<!-- build:css -->(.*?)<!-- /build:css -->', html, re.S)
    css_files = re.findall(r'href="(src/[^"]+\.css)"', css_block.group(1))
    css = '\n'.join(read(p) for p in css_files)
    html = html.replace(css_block.group(0), '<style>\n' + css + '\n</style>')

    js_block = re.search(r'<!-- build:js[^>]*-->(.*?)<!-- /build:js -->', html, re.S)
    js_files = re.findall(r'src="(src/[^"]+\.js)"', js_block.group(1))
    # A closing script tag inside a JS string would end the inline script early.
    js = '\n\n'.join(f'// ---- {p} ----\n' + read(p).replace('</script', '<\\/script') for p in js_files)
    html = html.replace(js_block.group(0), '<script>\n' + js + '\n</script>')

    outputs = [os.path.join(BASE, 'standalone.html'), os.path.join(BASE, 'dist', 'index.html')]
    os.makedirs(os.path.join(BASE, 'dist'), exist_ok=True)
    for out in outputs:
        with open(out, 'w', encoding='utf-8') as f:
            f.write(html)
        print(f'Wrote {os.path.relpath(out, BASE)} ({os.path.getsize(out):,} bytes)')


if __name__ == '__main__':
    build()
