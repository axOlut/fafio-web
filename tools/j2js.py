"""Conversion mécanique Java -> JS (classe -> fermeture). Les corrections fines sont faites à la main ensuite."""
import re, sys

TYPES = r'(?:(?:java\.util\.)?(?:[A-Z][\w]*(?:\.[A-Z]\w*)*)(?:<[^;=()]*?>)?(?:\[\])*|int(?:\[\])?|long|boolean|double|float|char|byte\[\]|byte)'
KW = {'return','new','else','if','for','while','switch','case','throw','do','try','catch','finally','break','continue'}

def strip_params(params):
    out = []
    for p in params.split(','):
        p = p.strip()
        if not p: continue
        p = re.sub(r'\bfinal\s+', '', p)
        out.append(p.split()[-1].replace('...', ''))
    return ', '.join(out)

def convert(src):
    src = re.sub(r'^\s*(package|import)\s[^;]*;\s*$', '', src, flags=re.M)
    src = re.sub(r'@\w+', '', src)
    # littéraux
    src = re.sub(r'(?<=[0-9A-Fa-f])L\b', '', src)
    src = re.sub(r'(?<=\d)f\b', '', src)
    src = re.sub(r'\.toUpperCase\(java\.util\.Locale\.ROOT\)', '.toUpperCase()', src)
    src = re.sub(r'\.toLowerCase\(java\.util\.Locale\.ROOT\)', '.toLowerCase()', src)
    src = src.replace('.split("\\\\r?\\\\n")', '.split(/\\r?\\n/)')
    # .replace("x","y") Java remplace toutes les occurrences
    src = re.sub(r'\.replace\((\"[^\"]*\"|\'.\'),', r'.replaceAll(\1,', src)
    # enums -> chaînes
    src = re.sub(r'\b(?:Doc|DocTheme)\.(?:\w+\.)*?(?:Align|Cover|Style|Heading|PageNum|Type)\.([A-Z_]+)\b', r'"\1"', src)
    src = re.sub(r'\b(?:Align|Cover|Style|Heading|PageNum|Type)\.([A-Z_]+)\b', r'"\1"', src)
    src = re.sub(r'\bcase ([A-Z_]+):', r'case "\1":', src)
    src = re.sub(r'new (?:java\.util\.)?(?:ArrayList|LinkedList)<[^>]*>\([^)]*\)', '[]', src)
    src = re.sub(r'Collections\.<\w+>emptyList\(\)', '[]', src)
    src = re.sub(r'new StringBuilder\(', 'new SB(', src)
    src = re.sub(r'\(int\)\s*', '~~', src)
    src = re.sub(r"\(long\)\s*", "~~", src)
    src = re.sub(r"\((?:double|float)\)\s*", "", src)
    src = re.sub(r'\.length\(\)', '.length', src)
    src = re.sub(r'\.size\(\)', '.length', src)
    src = re.sub(r'String\.valueOf\(', 'String(', src)
    src = re.sub(r'\bthrows [\w, .]+(?=\s*\{)', '', src)
    src = re.sub(r'catch\s*\(\s*[\w.| ]+\s+(\w+)\s*\)', r'catch (\1)', src)
    lines = src.split('\n')
    out = []
    for line in lines:
        s = line
        # modificateurs
        s = re.sub(r'\b(public|private|protected|static|final|synchronized)\s+', '', s)
        # for-each
        s = re.sub(r'for\s*\(\s*' + TYPES + r'\s+(\w+)\s*:\s*', r'for (const \1 of ', s)
        # for classique
        s = re.sub(r'for\s*\(\s*' + TYPES + r'\s+(\w+)\s*=', r'for (let \1 =', s)
        # déclaration de méthode
        m = re.match(r'^(\s*)(?:<\w+>\s*)?' + TYPES + r'\s+(\w+)\s*\(([^)]*)\)\s*\{\s*$', s)
        if m and m.group(2) not in KW:
            s = f'{m.group(1)}function {m.group(2)}({strip_params(m.group(3))}) {{'
        else:
            # constructeur / méthode void ou type déjà retiré
            m2 = re.match(r'^(\s*)void\s+(\w+)\s*\(([^)]*)\)\s*\{\s*$', s)
            if m2:
                s = f'{m2.group(1)}function {m2.group(2)}({strip_params(m2.group(3))}) {{'
            else:
                # déclaration de variable
                m3 = re.match(r'^(\s*)' + TYPES + r'\s+(\w+)\s*(=|;|,)(.*)$', s)
                if m3 and m3.group(2) not in KW and not re.match(r'^\s*(return|else|case)\b', s):
                    s = f'{m3.group(1)}let {m3.group(2)} {m3.group(3)}{m3.group(4)}'
        out.append(s)
    src = '\n'.join(out)
    src = re.sub(r'\.equals\(', '.equals(', src)
    return src

if __name__ == '__main__':
    print(convert(open(sys.argv[1]).read()))
