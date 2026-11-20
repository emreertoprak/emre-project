---
name: algorithm-research
description: Creator OS — YouTube / Shorts / Instagram / TikTok algoritmalarını ve format kurallarını birincil kaynaklardan araştırır, kendi verimle karşılaştırır ve kanal önerisi çıkarır ("algoritmayı analiz et", "TikTok neyi öne çıkarıyor", "Shorts kuralları").
---

# Algoritma araştırması

## Okur
- `brain/algorithms/<platform>.md`, `brain/platforms/<format>.md`
- MCP `creator`: `channel_list`, `performance_summary`, `sql_query`

## Adımlar
1. Kaynak önceliği: platformun resmi kaynakları (YouTube Creator Insider / Help Center / Official Blog; Instagram @creators, Meta Transparency Center "AI system cards"/öneri açıklamaları; TikTok Newsroom, Creator Academy, Support) → platform çalışanlarının kayıtlı açıklamaları → bağımsız araştırma. Forum/influencer iddialarını yalnızca "doğrulanmamış" etiketiyle yaz.
2. `brain/algorithms/<platform>.md` güncelle; her madde:
   `- [YYYY-MM-DD] iddia — kaynak: <URL> — kendi verimle: doğrulandı | çelişti | test edilmedi`
   Eski maddeyi yenisi geçersiz kılıyorsa silme, `~~üstünü çiz~~` ve yenisine bağla.
3. `brain/platforms/<format>.md` içine güncel teknik sınırları yaz (süre, oran, caption/hashtag karakter sınırı, kapak boyutu) — kaynaklı.
4. Kendi verinle karşılaştır: `sql_query` ile (ör. süre vs izlenme yüzdesi, yayın saati vs izlenme, format vs verdict). Örneklem 10 içerikten azsa "test edilmedi" bırak ve bunu belirt.
5. Doğrulanmamış ama önemli iddialar için `content-write`'ın kullanacağı deney önerileri çıkar (tek değişken).
6. `report_save { kind: "algorithm", title, body_md }`: platform başına "bu kanal için ne yapmalıyım" (5 madde), kaynak listesi.

## Kontroller
- Kaynaksız madde yazılmaz.
- Rapor tarih içerir; algoritma bilgisi zamanla eskir — 90 günden eski maddeleri yeniden doğrulamayı öner.
