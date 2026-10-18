# 🌟 Learning Quest — Daily Practice Hub

An interactive, tablet-optimized learning platform designed for stylus handwriting, memorization, and daily practice.

---

## 🚀 Live Access Links

* 📱 **[Master Quest Hub](https://nimrafarheen1995-ui.github.io/practice-app/)** *(Main launchpad for both tablets)*
* Open the hub, then tap Humayun or Zaina to see their lessons.

---

## 📚 Subject Architecture

The hub automatically detects and formats lessons for these 6 core subjects:

| Subject | Supported Keywords | Palette | Auto Icon |
| :--- | :--- | :--- | :--- |
| **English** | `english` | Blue | 📖 |
| **Maths** | `maths`, `math` | Amber | 🔢 |
| **EVS** | `evs`, `science` | Green | 🌱 |
| **Islamiyath** | `islamiyath`, `islam` | Teal | 🌙 |
| **Tamil** | `tamil` | Red | 🪔 |
| **Arabic** | `arabic` | Purple | 📜 |

---

## 📝 Daily Lesson File Naming Rules

When uploading new worksheets or quizzes, use the following pattern so `index.html` indexes them automatically without editing code:

```plaintext
<student>-<subject>-<optionalDate>.html


---

## 🔧 New in this version

* **shared/safe-storage.js** is loaded by every page. If the tablet's storage is full, writing is kept in a second store instead of being lost, and picture errors never break a page.
* **💾 Backup** (hub, bottom right) saves all writing and progress to one file and restores it later.
* **lessons.json** is the lesson list the hub reads. It is rebuilt automatically by `.github/workflows/update-lessons.yml` whenever you upload a lesson or picture. To rebuild by hand: `python3 tools/build_lessons.py`.
* **sw.js** keeps every lesson and picture in `lessons.json` offline. Change `VER` in `sw.js` to make every tablet refresh its saved copy.
