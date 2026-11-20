---
name: trend-scan
description: Creator OS — nişlerde yakalanabilir viral kısa videoları bulur ve seçilenleri referans olarak kaydeder ("trend bul", "viral tara", "bu hafta ne tutuyor").
---

# Trend taraması

## Okur
- MCP `creator`: `niche_list`, `trends_top`, `viral_ref_list`

## Adımlar
1. Proje kökünde `pnpm collect` çalıştır (YouTube Data API; Reddit kimliği varsa Reddit). Çıktıdaki ✗ satırlarını kullanıcıya aynen bildir (kota bitti, anahtar geçersiz vb.).
2. Her niş için `trends_top { niche, limit: 10 }`. Kullanıcıya tablo halinde göster: başlık, kanal, izlenme, outlier (izlenme ÷ takipçi), saatlik hız, ivme (↑/↓/–), link.
   - Sıralama sinyali outlier + ivme'dir; 10M izlenmiş büyük kanal videosu bitmiş trenddir — bunu kullanıcıya söyle.
   - İvme ilk koşularda boştur (en az 3 ölçüm gerekir); bunu "veri yok" diye belirt, uydurma.
3. Kullanıcının seçtikleri için `viral_ref_add { url, niche_key, notes }` (notes: neden seçildi).
4. Instagram / TikTok için otomatik tarama yok: kullanıcıdan link ve varsa transkript/caption iste, `viral_ref_add` ile kaydet.
5. Sonraki adım olarak `viral-adapt` skill'ini öner.

## Kontroller
- Aynı URL `viral_ref_list` içinde varsa ikinci kez ekleme.
- Trend verisi aralıklı koşuyla değerlenir: günde 2 koşu önerilir (`pnpm collect`), 30 dakikadan yakın ölçüm yazılmaz.
