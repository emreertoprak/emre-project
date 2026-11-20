---
name: content-write
description: Creator OS — bir kanal için haftalık içerik partisi yazar; tutan içeriklerin türevleri ağırlıklı, az sayıda kontrollü deney ("haftalık içerik", "bu hafta ne çekeyim", "X kanalı için 5 fikir").
---

# Haftalık içerik partisi (dene-yanıl)

## Okur
- MCP `creator`: `channel_list`, `performance_summary { channel_id, days: 60 }`, `experiment_list { channel_id }`, `content_list { channel_id }`
- `brain/creator.md`, `brain/niches/<key>/brand.md`, `brain/niches/<key>/learnings.md`
- `brain/algorithms/<platform>.md`, `brain/platforms/*.md`, `brain/rules/quality-gate.md`

## Kural: en az %70 kazanan türevi, en çok %30 deney
1. `performance_summary` içinden `verdict = winner` içerikleri al. Her biri için "neden kazandı" hipotezini `learnings.md` ve metriklerden (izlenme yüzdesi, etkileşim oranı, hook) çıkar.
2. Partinin **en az %70'i** kazananların türevi: aynı biçim/hook türü/konu açısı, yeni konu. Her biri `parent_content_id = <kazanan id>`.
3. **En çok %30'u** deney: her deney tek değişken değiştirir (hook türü, süre, format, kapak, yayın saati, konu açısı). Önce `experiment_upsert { channel_id, hypothesis, variable }`, sonra taslağa `experiment_id`.
4. Kanalda henüz kazanan yoksa (yeni kanal veya baseline yok — 5'ten az ölçülmüş içerik): partinin tamamı deneydir; deneyleri birbirinden farklı değişkenlere yay ki kısa sürede kazanan bulunsun.
5. `running` durumdaki bir deneyle aynı değişkeni test eden yeni deney açma.

## Adımlar
1. Kullanıcıya kanal ve parti büyüklüğünü sor (varsayılan 5).
2. Yukarıdaki kurala göre fikir listesi çıkar; her fikir için: başlık, format, hook, neden (kazanan türevi → hangi içerik; deney → hipotez).
3. Kullanıcı onaylarsa her fikir için senaryo + caption + hashtag yaz, `quality-gate.md`'den geçir, `content_create`.
4. Platform algoritma notlarında (`brain/algorithms/<platform>.md`) "kendi verimle: çelişti" işaretli maddeleri uygulama.

## Çıktı
- `draft` durumunda içerikler; deneyler `running`. Kullanıcıya: "Panelde /icerik sayfasından onayla."
