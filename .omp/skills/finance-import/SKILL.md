---
name: finance-import
description: Creator OS — Yapı Kredi / Enpara kredi kartı ve hesap ekstrelerini (PDF/Excel) okuyup giderleri kategorize ederek içe aktarır, aylık özet çıkarır ("ekstre yükle", "giderlerimi işle", "bu ay ne harcadım").
---

# Ekstre içe aktarma

Bireysel müşteriler için bankaların ekstre API'si yok (Türkiye açık bankacılığı lisanslı kuruluşlara açık); bu yüzden ekstre dosyası kullanılır.

## Okur
- MCP `creator`: `card_list`, `channel_list`, `expense_summary`
- `inbox/statements/*` (kullanıcının bıraktığı dosyalar)

## Ekstre nasıl alınır (kullanıcıya söyle)
- Yapı Kredi: Mobil/İnternet Şube → Kartlarım → kart → Ekstre → PDF indir. Hesap hareketleri için Hesaplarım → Hesap Hareketleri → Excel/PDF.
- Enpara: Cep Şube/İnternet Şube → Kartlar → Ekstreler (PDF), Hesap hareketleri → dışa aktar.
- Dosyayı `inbox/statements/` klasörüne bırak.

## Adımlar
1. Kart yoksa `card_list` boştur: kullanıcıya panelde `/giderler` sayfasından kart eklemesini söyle (banka, takma ad, **yalnızca son 4 hane**, limit, kesim günü, son ödeme günü).
2. Dosyayı oku (PDF metni veya Excel). Ekstrenin kartını son 4 haneden `card_list` ile eşle; eşleşmezse sor.
3. Satırları çıkar: tarih (YYYY-MM-DD), tutar (harcama pozitif; iade/ödeme satırları **atlanır** — kart borç ödemesi gider değildir), işyeri.
4. Kategori: `ekipman, yazilim-abonelik, reklam, uretim, egitim, market, fatura, ulasim, yeme-icme, kisisel, diger`. İçerik üretimiyle ilgili harcamada (ekipman, yazılım, reklam, üretim, eğitim) hangi kanal için olduğunu biliyorsan `channel_id` ver. Emin olmadığın satırları toplu liste olarak kullanıcıya sor; tahminle doldurma.
5. `expense_add_many { statement: { card_id, file_path, period_start, period_end, total }, rows }`. Dönen `skipped_duplicates` > 0 ise "bu satırlar daha önce içe aktarılmış" de.
6. `expense_summary { month }` → kısa özet; kanal yatırımı (ekipman+yazılım+reklam+üretim+eğitim) ile kişisel harcamayı ayır. `report_save { kind: "finance", title, body_md }`.

## Kontroller
- Kart numarasının son 4 hanesi dışında hiçbir kart verisi (tam numara, CVV, son kullanma, müşteri no) hiçbir yere yazılmaz — rapora da.
- İşlenen dosya `inbox/` altında kalır (git'e girmez).
