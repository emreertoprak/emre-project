---
name: viral-adapt
description: Creator OS — viral bir videoyu çözümler ve marka kimliğime göre hedef kanalın platformuna uyarlanmış taslak üretir ("bunu uyarla", "bu videoyu benim tarzıma çevir", viral referans ID'si).
---

# Viral uyarlama

## Okur
- MCP `creator`: `viral_ref_list`, `channel_list`, `content_list`
- `brain/creator.md`, `brain/niches/<key>/brand.md`, `brain/niches/<key>/learnings.md`
- `brain/platforms/<hedef platform dosyası>.md`, `brain/rules/quality-gate.md`

## Adımlar
1. Referansı seç (`viral_ref_list { niche_key }`). Transkript boşsa:
   - YouTube: `yt-dlp --skip-download --write-auto-subs --sub-langs "tr.*,en.*" --sub-format vtt -o "inbox/subs/%(id)s" <url>` → VTT'den metni çıkar.
   - Instagram/TikTok: `media-use` skill'ini kullanarak ses → transkript çıkar (yt-dlp indirmesi için `--cookies-from-browser $YTDLP_COOKIES_BROWSER`). Olmuyorsa kullanıcıdan caption/transkript iste.
2. Çözümle ve `viral_ref_set_analysis` ile kaydet. Başlıklar: **Hook türü** (soru / şok iddia / sonuç-önce / liste / POV / kontrast), **Vuruşlar** (saniye aralıklarıyla), **Tempo** (kesme sıklığı, süre), **Görsel dil**, **CTA**, **Neden tuttu** (izleyicinin hangi ihtiyacı), **Kopyalanabilir biçim** (tek cümle şablon).
3. Hedef kanalı seç: referansın nişiyle **aynı nişteki** kanal(lar). Başka nişin kanalına uyarlama yapma.
4. Platforma göre yaz (`brain/platforms/*`): YouTube long → 16:9 bölümlü senaryo; YouTube Shorts / Reels / TikTok → 9:16, saniye işaretli çekim senaryosu; carousel → slayt slayt metin.
5. Biçimi al, cümleleri alma: içerik kullanıcının kendi deneyimi ve `brand.md` sesiyle yazılır.
6. `brain/rules/quality-gate.md` kontrolünden geçir. Kanalın 5'ten fazla içeriği varsa ve bu bir kazanan türevi değilse `experiment_upsert` ile hipotez aç (`variable`: denenen tek değişken, ör. "hook türü: sonuç-önce").
7. `content_create { channel_id, title, format, hook, script_md, caption, hashtags, viral_ref_id, experiment_id? }`. Durum otomatik `draft` olur; kullanıcıya panelde `/icerik/<id>` adresinden onaylamasını söyle.

## Kontroller
- Agent içeriği onaylayamaz (`content_update` ile `approved` reddedilir) — deneme.
- Hashtag'ler nişin `hashtags` listesi + içerik özelinde 3–5 adet; platform sınırını aşma.
