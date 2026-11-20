---
name: performance-review
description: Creator OS — metrikleri çeker, kanal başına neyin tuttuğunu/tutmadığını ve nasıl düzelteceğimi raporlar; deneyleri sonuçlandırır ("haftalık rapor", "ne yanlış yaptım", "bu video neden tutmadı", "performans").
---

# Performans değerlendirmesi

## Okur
- MCP `creator`: `channel_list`, `performance_summary { channel_id, days }`, `content_get`, `experiment_list`, `sql_query`, `report_list`
- `brain/niches/<key>/learnings.md`, `brain/algorithms/<platform>.md`

## Adımlar
1. Proje kökünde `pnpm sync` çalıştır; ⚠ satırlarını (yt-dlp çerezi, kota, yetki) kullanıcıya aynen bildir.
2. Her aktif kanal için `performance_summary { channel_id, days: 7 }` (haftalık) ve gerekirse 30 gün.
3. Rapor (kanal başına):
   - **Tablo**: içerik, format, izlenme, baseline'a oran, etkileşim oranı, izlenme yüzdesi (varsa), verdict.
   - **Kazananlar**: ortak kalıplar — hook türü, süre, format, konu açısı, yayın günü/saati (`sql_query` ile `published_at`). Her kalıp için kanıt: hangi içerikler.
   - **Kaybedenler**: neyin yanlış gittiği; mümkün olan en somut neden (ilk 3 saniye, izlenme yüzdesi düşüklüğü, konu-niş uyumsuzluğu, kapak). Kanıt yoksa "veri yetersiz" de.
   - **Sonraki hafta için 3–5 somut düzeltme** (ölçülebilir: "hook'u sonuç-önce yaz", "süreyi 35 sn altına indir").
   - **Eksik veri**: metriği olmayan yayınlanmış içerikler (URL girilmemiş, yt-dlp başarısız) — bunlar hakkında yorum yapma.
4. Deneyler: `running` deneylerin bağlı içerikleri `pending` değilse sonuçlandır → `experiment_upsert { id, channel_id, hypothesis, variable, status: won | lost | inconclusive, verdict_md }`. Tek içerikle kesin hüküm verme; 2'den az ölçülmüş içerikte `inconclusive`.
5. `brain/niches/<key>/learnings.md` sonuna tarihli ekleme yap (`## YYYY-MM-DD`): kazanan kalıplar, kaybeden kalıplar, sonuçlanan deneyler. Eski satırları silme.
6. `report_save { kind: "weekly", channel_id, period_start, period_end, title, body_md }`.
7. Tek bir içerik sorulursa ("bu video neden tutmadı"): `content_get` + kanal baseline ile karşılaştır → `report_save { kind: "postmortem", channel_id, title, body_md }`.

## Kontroller
- Her iddia bir sayıya veya içerik id'sine dayanır.
- Verdict tanımı sabit: winner ≥ 1.5× baseline, loser ≤ 0.5×, 48 saatten genç veya baseline yok → pending.
