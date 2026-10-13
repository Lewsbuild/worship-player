# 🎵 Worship Player

Church music player (PWA) na pwedeng i-install sa phone, may **download** at **offline playback**.

Naka-built-in na ang listahan ng mga worship artist (Hillsong, Bethel, Victory Worship, Gary Valenciano, atbp.). Ikaw ang magdadagdag ng mga kanta.

> ⚠️ **Tungkol sa copyright**
> Walang kasamang kanta ang app na ito. Ang mga kanta ng mga artist na nasa listahan ay copyrighted.
> - Ang **GitHub Pages ay PUBLIC**. Kapag nag-upload ka ng copyrighted na mp3 doon, ipinamamahagi mo ito sa buong mundo, na bawal.
> - Safe na gamitin: (1) mga kantang binili/na-download mo nang legal at idinagdag **mula sa phone** (nananatili lang sa device mo), (2) mga kantang may pahintulot o lisensya ang church (halimbawa CCLI / OneLicense, o direktang permiso ng artist), (3) mga royalty-free o original na kanta ng church mismo.

---

## 🎚 Equalizer

I-tap ang **🎚 EQ** sa taas ng app.

- **5 band** ang default. Pwede mong palitan ng **7, 8, 9, 10, 11 o 12 band** sa *Bands* menu.
- I-drag ang bawat slider (−12 dB hanggang +12 dB). Ang mababang frequency ay nasa kaliwa at ang mataas ay nasa kanan.
- May mga preset: Flat, Bass Boost, Treble Boost, Vocal / Worship, Warm, Loudness.
- **On** ay para i-bypass ang EQ, **Reset** ay para ibalik sa flat.
- Naka-save ang settings mo bawat bilang ng band, kahit isara ang app.
- Kapag may boost, kusang binababaan ng app ang kabuuang volume para hindi mapunit ang tunog.

Paalala: para gumana ang EQ, ang kantang pinapatugtog ay dapat galing sa phone (Add Song), na-download na (⬇), o nasa app mismo. Ang kantang galing sa ibang website na walang CORS ay maaaring walang tunog kapag naka-on ang EQ.

---

## Paano gamitin ang app

**Magdagdag ng kanta mula sa phone (pinakamadali, pinakaligtas)**
1. Tap **+ Add Song**
2. Piliin o i-type ang artist
3. Pumili ng audio file(s) → **Save**
4. Naka-save na sa phone, pwede na offline.

**Magdagdag ng kanta na naka-host sa app (para sa mga may lisensya)**
1. Ilagay ang mp3 sa folder na `songs/`
2. Idagdag sa `catalog.json`:
   ```json
   [
     { "title": "Pamagat ng Kanta", "artist": "Victory Worship", "url": "songs/pamagat.mp3" }
   ]
   ```
3. I-push sa GitHub (tingnan sa baba). Lalabas ang kanta sa lahat ng nakabukas na app.
4. I-tap ang **⬇** sa kanta para i-download offline.

---

## Step-by-step: I-deploy gamit ang Termux + GitHub

### A. Ihanda ang Termux

1. I-install ang **Termux mula sa F-Droid** (https://f-droid.org). Huwag sa Play Store, luma na ang version doon.
2. Buksan ang Termux at i-run:
   ```bash
   pkg update -y && pkg upgrade -y
   pkg install -y git unzip
   termux-setup-storage
   ```
   Tap **Allow** kapag nag-prompt para sa storage permission.

### B. Gumawa ng GitHub account at repository

1. Mag-sign up sa https://github.com (kung wala pa).
2. Pindutin ang **+** → **New repository**.
3. Repository name: `worship-player`
4. Piliin ang **Public** (kailangan para sa libreng GitHub Pages), **huwag** i-check ang "Add a README".
5. Pindutin ang **Create repository**.

### C. Gumawa ng Personal Access Token (pamalit sa password)

1. GitHub → profile picture → **Settings** → **Developer settings** → **Personal access tokens** → **Tokens (classic)** → **Generate new token (classic)**.
2. Note: `termux`. Expiration: 90 days. I-check ang **repo**.
3. **Generate token** at i-copy agad ang token (isang beses lang ito ipapakita).

### D. Ilipat ang project sa Termux

1. I-download ang `worship-player.zip` mula sa chat na ito. Mapupunta ito sa **Downloads** folder.
2. Sa Termux:
   ```bash
   cp ~/storage/downloads/worship-player.zip ~
   cd ~
   unzip worship-player.zip
   cd worship-player
   ```

### E. I-push sa GitHub

Palitan ang `USERNAME` ng GitHub username mo at ang email/pangalan mo:

```bash
git config --global user.name "Pangalan Mo"
git config --global user.email "email@example.com"

git init
git add .
git commit -m "Initial commit: Worship Player"
git branch -M main
git remote add origin https://github.com/USERNAME/worship-player.git
git push -u origin main
```

Kapag humingi ng:
- **Username**: GitHub username mo
- **Password**: i-paste ang **token** (hindi lalabas ang tina-type, normal iyon)

### F. I-on ang GitHub Pages

1. Sa repo sa GitHub: **Settings** → **Pages**.
2. **Source**: *Deploy from a branch*.
3. **Branch**: `main`, folder `/ (root)` → **Save**.
4. Maghintay ng 1–2 minuto. Lalabas ang link:
   `https://USERNAME.github.io/worship-player/`

### G. I-install sa phone

1. Buksan ang link sa **Chrome** (Android).
2. Menu (⋮) → **Install app** / **Add to Home screen**.
3. Buksan muna ito habang may internet para ma-save ang app. Pagkatapos, gagana na ito **offline**.

(Sa iPhone: Safari → Share → **Add to Home Screen**.)

---

## Mag-update ng app o catalog

```bash
cd ~/worship-player
# i-edit ang catalog.json o magdagdag ng file sa songs/
git add .
git commit -m "Update catalog"
git push
```

Pagkatapos ng 1–2 minuto, i-refresh ang app. Kung hindi nag-update, isara at buksan ulit ito (o dagdagan ang `CACHE` version sa `sw.js`, halimbawa `worship-player-v2`).

## Mga limitasyon

- Limit ng GitHub: ~100 MB bawat file at ~1 GB bawat repo, kaya kaunting kanta lang ang pwede doon.
- Kapag nag-clear ka ng browser data, mabubura ang mga kantang naka-save sa app.
- Mga kantang dinagdag mula sa phone ay nasa device na iyon lang. Hindi sila nagsi-sync sa ibang phone.

## Mga file

| File | Gamit |
|---|---|
| `index.html`, `style.css`, `app.js` | Ang app |
| `eq.js` | Ang equalizer (5 hanggang 12 band) |
| `artists.js` | Listahan ng mga artist (pwedeng i-edit) |
| `catalog.json` | Listahan ng mga kantang naka-host sa app |
| `sw.js`, `manifest.webmanifest`, `icon-*.png` | Para sa offline at pag-install |
