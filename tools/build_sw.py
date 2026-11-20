"""Génère sw.js : liste de tous les fichiers à garder hors ligne + version (empreinte du contenu)."""
import hashlib, os, json
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
files = []
for d, _, fs in os.walk(ROOT):
    rel = os.path.relpath(d, ROOT)
    if rel.startswith(('.git', 'tools', 'docs', 'server')) or '/.' in rel: continue
    for f in sorted(fs):
        if f in ('sw.js', 'README.md', '.nojekyll') or f.startswith('.') or f.startswith('zz_') or f == 'cases.txt': continue
        files.append(os.path.normpath(os.path.join(rel, f)).replace(os.sep, '/'))
files.sort()
h = hashlib.sha256()
for f in files: h.update(f.encode()); h.update(open(os.path.join(ROOT, f), 'rb').read())
version = h.hexdigest()[:10]
urls = ['./'] + [f for f in files]
sw = f'''// Généré par tools/build_sw.py — garde FAFIO disponible hors ligne.
const CACHE = "fafio-{version}";
const FILES = {json.dumps(urls, indent=0)};

self.addEventListener("install", (e) => {{
    e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
}});

self.addEventListener("activate", (e) => {{
    e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
}});

self.addEventListener("fetch", (e) => {{
    if (e.request.method !== "GET") return;
    e.respondWith(caches.match(e.request, {{ ignoreSearch: true }}).then((hit) => hit || fetch(e.request).then((r) => {{
        if (r.ok && new URL(e.request.url).origin === location.origin) {{ const copy = r.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); }}
        return r;
    }}).catch(() => caches.match("./"))));
}});
'''
open(os.path.join(ROOT, 'sw.js'), 'w').write(sw)
print(version, len(files), 'fichiers')
