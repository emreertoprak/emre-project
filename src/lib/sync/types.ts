/** Kendi kanallarımın metrik kaynağı. Kimlik bilgisi yoksa atlanır, hata verirse diğerleri devam eder. */
export type SyncSource = {
  name: string;
  isConfigured(): boolean;
  run(): Promise<{ written: number; errors: string[] }>;
};
