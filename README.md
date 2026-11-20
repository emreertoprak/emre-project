# Creator OS

Kişisel influencer büyüme sistemi: viral içerikleri marka kimliğine uyarlar, kanal başına (bir kanal = bir niş) dene-yanıl ile tutan içeriğin türevlerini üretir, creative hazırlar, metrikleri çeker, agent'lara rapor yazdırır, giderleri ve kartları tutar. Tek kullanıcılık, yerel çalışır.

```
Panel (Next.js, Türkçe) ─┐
                         ├─ data/creator.db (SQLite) ─ MCP sunucusu "creator" ─ omp / Claude Code skill'leri
CLI (collect/sync) ──────┘                                                    └─ brain/ (marka beyni, markdown)
```

## Kurulum

```bash
pnpm install
cp .env.example .env.local   # YOUTUBE_API_KEY zorunlu
pnpm health
pnpm dev                     # http://localhost:3000
```

| Değişken | Ne için |
|---|---|
| `YOUTUBE_API_KEY` | Trend taraması + YouTube kanal/video sayıları (Google Cloud → YouTube Data API v3 → API key) |
| `REDDIT_CLIENT_ID/SECRET` | Opsiyonel trend kaynağı (reddit.com/prefs/apps → script app; anonim erişim 403) |
| `YOUTUBE_OAUTH_CLIENT_ID/SECRET` | Opsiyonel: izlenme süresi/yüzdesi, abone kazancı. Google Cloud → OAuth client (Desktop) → `pnpm yt-auth <kanal-id>` |
| `YTDLP_COOKIES_BROWSER` | Instagram/TikTok metrikleri yt-dlp ile bu tarayıcının oturumundan çekilir (oturum açık olmalı) |

## Akış

1. Agent'ı proje kökünde aç (omp veya `claude`): `brand-onboarding` → `brain/creator.md`, nişler, kanallar.
2. `trend-scan` → `viral-adapt` / `content-write` → taslaklar.
3. Panelde `/icerik/<id>` → **Onayla** → `creative-produce` → çek/üret → **Yayınlandı** (URL gir).
4. `pnpm sync` (veya `performance-review`) → rapor `/raporlar`, öğrenilenler `brain/niches/<key>/learnings.md`.
5. Ekstre PDF/Excel'ini `inbox/statements/` içine bırak → `finance-import`.

"Tutan içerik": son 20 içeriğin izlenme medyanının ≥1.5 katı (kaybeden ≤0.5×; 48 saatten genç içerik yargılanmaz). `content-write` partinin en az %70'ini kazanan türevi, en çok %30'unu deney olarak yazar.

## Platform gerçeği

| Kaynak | Durum |
|---|---|
| YouTube / Shorts | Resmî API (anahtar) + Analytics (OAuth) |
| Instagram, TikTok | Resmî API yalnızca iş hesabı onayıyla; burada yt-dlp + tarayıcı çerezi, olmazsa panelden elle metrik |
| Banka (Yapı Kredi, Enpara) | Bireysel ekstre API'si yok → ekstre dosyası içe aktarma |

## Komutlar

`pnpm dev` · `pnpm collect` · `pnpm sync` · `pnpm health` · `pnpm yt-auth <id>` · `pnpm mcp` · `pnpm test` · `pnpm typecheck`
# emre-project
