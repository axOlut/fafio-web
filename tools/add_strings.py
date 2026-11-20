"""Ajoute des textes (fr, en, ar) à l'application Android (strings.xml) et à la version web (js/i18n.js).
Usage : python3 tools/add_strings.py strings.json  (objet { clé: [fr, en, ar] })."""
import json, re, sys
RES = '/home/claude/fafio-android/app/src/main/res/'
WEB = '/home/claude/fafio-web/js/i18n.js'
new = json.load(open(sys.argv[1]))

def xml_esc(s):
    s = s.replace('&', '&amp;').replace('<', '&lt;').replace('>', '&gt;')
    s = s.replace('\\', '\\\\').replace("'", "\\'").replace('"', '\\"').replace('\n', '\\n')
    if s.startswith('@') or s.startswith('?'): s = '\\' + s
    return s

for i, folder in enumerate(['values', 'values-en', 'values-ar']):
    p = RES + folder + '/strings.xml'
    x = open(p, encoding='utf-8').read()
    for k, v in new.items():
        line = f'    <string name="{k}">{xml_esc(v[i])}</string>'
        pat = re.compile(r'    <string name="' + re.escape(k) + r'"( formatted="false")?>.*?</string>')
        if pat.search(x): x = pat.sub(lambda m: line, x)
        else: x = x.replace('</resources>', line + '\n</resources>')
    open(p, 'w', encoding='utf-8').write(x)

src = open(WEB, encoding='utf-8').read()
head, body = src.split('export default ', 1)
data = json.loads(body.rstrip().rstrip(';'))
for i, lang in enumerate(['fr', 'en', 'ar']):
    for k, v in new.items(): data[lang][k] = v[i]
open(WEB, 'w', encoding='utf-8').write(head + 'export default ' + json.dumps(data, ensure_ascii=False, indent=1) + ';\n')
print('ok', len(new))
