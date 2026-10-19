# Learning Quest — Daily Practice Hub

Interactive practice lessons for **Humayun** (Samsung Tab S9) and **Zaina** (Samsung Tab S11).

This app stays on our tablets. It is not a public product — just a family learning kit.

---

## Open the hub

- Live hub (if deployed): use your GitHub Pages link  
- Or open `index.html` on the tablet

From the hub: choose the child → choose the subject → open a lesson.

---

## How lessons are named

```
<student>-<subject>-<date>.html
```

Examples:

- `zaina-maths-oct19.html`
- `humayun-evs-oct16.html`
- `zaina-islamiyath-oct19.html`

Subjects the hub understands: **english**, **maths**, **evs**, **islamiyath**, **tamil**, **arabic**

---

## Add a new lesson (simple path)

1. Copy an existing lesson that is closest to what you need  
   (for example, copy a Zaina maths file to make another Zaina maths lesson).
2. Rename the copy using the pattern above.
3. Change:
   - the title
   - the questions and answers
   - characters / theme if you want
4. Save the file in the main folder (same place as the other `.html` lessons).
5. Rebuild the lesson list (see below).
6. Open the hub on the tablet and check the new lesson appears.

---

## Rebuild the lesson list

The hub reads `lessons.json` to know which lessons exist.

**Automatic:**  
If you use GitHub, pushing a new `.html` or asset can run the update workflow.

**By hand on the computer:**

```bash
python3 tools/build_lessons.py
```

That refreshes `lessons.json`.

---

## Folders (what lives where)

| Folder / file | Purpose |
|---------------|---------|
| `index.html` | Main hub (pick child → subjects → lessons) |
| `lessons.json` | List of lessons the hub shows |
| `*.html` | Individual lesson pages |
| `assets/` | Pictures, videos, badges |
| `shared/` | Code shared by several lessons (storage, notebook helpers) |
| `tools/` | Script that rebuilds `lessons.json` |
| `sw.js` | Offline support (service worker) |
| `manifest.json` | Home-screen / app-style settings |

---

## Tablets

| Child | Tablet |
|-------|--------|
| Humayun (9) | Samsung Galaxy Tab S9 |
| Zaina (10) | Samsung Galaxy Tab S11 |

Tips:

- Test new lessons on the real tablet (portrait and landscape).
- Use the **Backup** button on the hub before a tablet reset or big update.
- Prefer clear file names in `assets/` so you can find things later.

---

## Backup of writing and progress

On the hub (bottom area):

- **Backup** — saves writing and progress to a file  
- **Restore** — loads a previous backup file  

Use this if a tablet is reset or you move to a new device.

---

## Optional: offline refresh

If lessons or pictures look old after an update, change the version text inside `sw.js` (the `VER` value), then reload the hub on the tablet so it fetches a fresh copy.

---

## Notes for future me

- One exercise at a time is enough.
- Copy a good lesson instead of starting from a blank page.
- Keep video backgrounds light (teach screens are fine; practice screens stay calm).
- Perfect code is not the goal — clear practice for the kids is the goal.

---

*Made for Humayun and Zaina.*
