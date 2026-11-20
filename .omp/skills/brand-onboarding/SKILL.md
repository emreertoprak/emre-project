---
name: brand-onboarding
description: Creator OS — kişisel marka kimliğini, nişleri ve kanalları kurar ("profilimi oluştur", "yeni niş", "yeni kanal aç"). brain/creator.md boşsa diğer içerik skill'lerinden önce çalışır.
---

# Marka kurulumu

## Okur
- `brain/creator.md`, `brain/niches/*/brand.md` (varsa)
- MCP `creator`: `niche_list`, `channel_list`

## Adımlar
1. `brain/creator.md` boşsa sırayla **tek tek** sor (aynı mesajda birden fazla soru sorma): kim olduğu ve neyi gerçekten yaşadığı/bildiği; 12 aylık hedefi (takipçi, gelir değil — beceri ve kalite hedefleri dahil); ses/üslup (3 sıfat + kaçındığı üslup); asla yapmayacakları; kamera önünde mi, ses mi, metin mi.
2. Cevapları kullanıcının kelimeleriyle `brain/creator.md`'ye yaz; uydurma veya süsleme yapma.
3. Her niş için:
   - `niche_upsert` — `key` küçük harf-tire; `queries`: YouTube'da aranacak 3–6 Türkçe/İngilizce kısa video arama terimi; `subreddits` ve `hashtags` varsa.
   - `brain/niches/<key>/brand.md`: hedef kitle (kim, ne istiyor, neden izler), 3–5 içerik sütunu, nişe özel ses kuralları, örnek hook'lar, yasaklar.
   - Boş `brain/niches/<key>/learnings.md` (başlık: `# <label> — öğrenilenler`).
4. Her kanal için `channel_upsert` (platform: youtube | instagram | tiktok; YouTube Shorts ayrı kanal değildir, YouTube kanalında `format: short` içeriktir).
5. Kullanıcı aynı kanala ikinci niş eklemek isterse **reddet**: "Bir kanal = bir niş. Algoritma kanalı tek bir kitleye öğrenir; farklı niş farklı kanal ister." ve yeni kanal açmayı öner.
6. Sonunda `brain/creator.md` → "Kanallarım" bölümüne kanal listesi (platform, @handle, niş) yaz.

## Çıktı
- `brain/creator.md`, `brain/niches/<key>/{brand,learnings}.md`, `niches` ve `channels` tabloları.

## Kontroller
- `channel_list` çıktısındaki her kanalın `niche_key`'i `niche_list`'te var.
- YouTube kanalları için kullanıcıya: panelde `/kanallar` sayfasındaki kanal id'siyle isteğe bağlı `pnpm yt-auth <id>` (izlenme süresi/yüzdesi için).
