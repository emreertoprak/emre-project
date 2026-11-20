---
name: creative-produce
description: Creator OS — onaylı içerik için çekim listesi, kapak/thumbnail brief'i ve istenirse AI görsel/video (organik veya reklam) üretir ("creative üret", "kapak yap", "reklam videosu", "thumbnail").
---

# Creative üretimi

## Okur
- MCP `creator`: `content_get { id }`, `channel_list`
- `brain/creator.md`, `brain/niches/<key>/brand.md`, `brain/platforms/*.md`

## Ön koşul
- İçerik `approved` (veya sonrası) olmalı. `draft` ise üretme; kullanıcıya önce panelden onaylamasını söyle.

## Adımlar
1. **Çekim listesi**: senaryodaki her vuruş için çekim (kadraj, hareket, süre, B-roll, ekran metni). Kullanıcı kendisi çekecekse bu yeterli.
2. **Kapak / thumbnail brief'i**: tek mesaj, ≤4 kelime ekran metni, yüz ifadesi/odak nesnesi, kontrast; nişin `brand.md` görsel kuralları.
3. **Oran**: short / reel / tiktok → `9:16`; long → `16:9` (thumbnail `16:9`); carousel / post → `4:5`.
4. **AI üretimi** (kullanıcı isterse):
   - Görsel, video, reklam (UGC, ürün tanıtımı, Marketing Studio) → `higgsfield-generate` skill'ini oku ve izle. `higgsfield` PATH'te yoksa o skill'in bootstrap adımı; oturum yoksa kullanıcıdan `higgsfield auth login` iste.
   - Kod/HTML tabanlı hareketli grafik, altyazılı açıklayıcı video → `hyperframes` skill'i.
   - Bitmiş videonun hook/dikkat skoru → `higgsfield-generate` içindeki Virality Predictor.
5. Çıktıyı `creatives/<content_id>/` altına indir (`curl -L -o creatives/<id>/<ad>.<uzantı> <url>`).
6. Her dosya için `creative_register { content_id, kind, purpose, tool, prompt, file_path: "creatives/<id>/<dosya>", remote_url?, aspect_ratio }`.
   - `purpose`: organik paylaşım → `organic`; ücretli reklam varyantı → `ad` (reklam için en az 2 varyant: farklı hook).
   - AI üretimi yapılamadıysa brief + prompt'u `tool: "manual"` ile kaydet ve kullanıcıya hangi ön koşulun eksik olduğunu söyle.

## Kontroller
- Panelde `/creative` sayfasında dosyalar görünür.
- Reklam creative'inde iddia/sayı varsa kaynak gösterilebilir olmalı (`quality-gate.md` madde 2).
