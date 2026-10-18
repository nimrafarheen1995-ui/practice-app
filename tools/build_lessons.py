#!/usr/bin/env python3
"""Builds lessons.json (the lesson list for the hub and the offline file list for sw.js).
Run it from the repository root:  python3 tools/build_lessons.py
The GitHub Action in .github/workflows runs it automatically every time you upload."""
import glob, json, os, re, datetime

root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
os.chdir(root)
lessons = sorted(f for f in glob.glob('*.html') if f != 'index.html' and re.match(r'(humayun|zaina)', f, re.I))
refs = set()
for f in lessons + ['index.html'] + glob.glob('shared/*.js'):
    text = open(f, encoding='utf8', errors='ignore').read()
    refs.update(re.findall(r'assets/([A-Za-z0-9_.\-]+)', text))
have = set(os.listdir('assets')) if os.path.isdir('assets') else set()
assets = sorted('assets/' + a for a in refs if a in have and not a.lower().endswith(('.mp4', '.webm')))
missing = sorted(a for a in refs if a not in have)
out = {'generated': datetime.datetime.now(datetime.timezone.utc).strftime('%Y-%m-%d %H:%M UTC'), 'lessons': lessons, 'assets': assets}
open('lessons.json', 'w', encoding='utf8').write(json.dumps(out, indent=1) + '\n')
print(f'{len(lessons)} lessons, {len(assets)} offline pictures written to lessons.json')
if missing: print('WARNING: pages mention pictures that are not in assets/:', ', '.join(missing))
