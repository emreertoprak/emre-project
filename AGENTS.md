# Creator OS

Tek kullanıcılık (satış amaçlı değil) kişisel influencer büyüme sistemi. Veri tek SQLite dosyasında (`data/creator.db`); panel (`pnpm dev`, Türkçe) ve agent aynı veriyi kullanır. Agent veriye yalnızca `creator` MCP sunucusu (`pnpm mcp`, `.omp/mcp.json` / `.mcp.json`) üzerinden erişir; marka bilgisi `brain/` altındaki markdown dosyalarındadır. Her niş ayrı kanaldır; kanal içinde tutan içeriklerin türevleri üretilir, yeni fikirler kontrollü deney olarak denenir.

## Niyet → skill

| Kullanıcı ne diyor | Skill |
|---|---|
| profil, marka kimliği, yeni niş, yeni kanal | `brand-onboarding` |
| trend bul, viral tara, ne tutuyor | `trend-scan` |
| bunu uyarla, bu videoyu benim tarzıma çevir, viral referans | `viral-adapt` |
| haftalık içerik, ne çekeyim, X kanalı için fikir | `content-write` |
| creative, kapak, thumbnail, reklam görseli/videosu | `creative-produce` |
| rapor, ne yanlış yaptım, bu video neden tutmadı, performans | `performance-review` |
| algoritma, platform kuralları, nasıl daha çok izlenirim | `algorithm-research` |
| ekstre, gider, kart, bu ay ne harcadım | `finance-import` |

`brain/creator.md` boşsa içerik üretmeden önce `brand-onboarding` çalışır.

## Değişmez kurallar

- Agent yalnızca `idea`/`draft` içeriklerle çalışır (durum ve metin). Onay, üretildi, yayınlandı yalnızca panelden (`/icerik/<id>`); onaylanmış içeriğin metnini de yalnızca kullanıcı değiştirir.
- Bir kanal = bir niş. Var olan kanalın nişi değiştirilemez; farklı niş için yeni kanal açılır.
- Metriği olmayan içerik hakkında performans yorumu yapılmaz; eksik veri açıkça listelenir.
- Kaynaksız algoritma iddiası yazılmaz (`brain/algorithms/*`: her madde tarih + URL).
- Kart verisi: yalnızca banka, takma ad, son 4 hane, limit, kesim/son ödeme günü. Tam numara, CVV, son kullanma hiçbir yere yazılmaz.
- Viral içerikten biçim alınır, cümle kopyalanmaz.

## Komutlar

| Komut | Ne yapar |
|---|---|
| `pnpm dev` | Panel: http://localhost:3000 |
| `pnpm collect` | Nişlerde YouTube (+Reddit) trend taraması |
| `pnpm sync` | Kendi içeriklerimin metrikleri (YouTube API / Analytics, Instagram-TikTok için yt-dlp) |
| `pnpm health` | Anahtarlar, araçlar, tablo sayıları |
| `pnpm yt-auth <kanal-id>` | YouTube Analytics OAuth (izlenme süresi/yüzdesi) |
| `pnpm test` / `pnpm typecheck` | Testler / tip kontrolü |

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
