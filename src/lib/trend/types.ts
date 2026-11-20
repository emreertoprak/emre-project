/** Tüm platformlardan gelen içeriğin ortak şeması. */
export type Platform = 'youtube' | 'tiktok' | 'instagram' | 'reddit';

export type TrendItem = {
  /** `${platform}:${nativeId}` */
  id: string;
  platform: Platform;
  nativeId: string;
  url: string;
  title: string;
  /** Açıklama/caption — kısaltılmış halde saklanır. */
  caption: string;
  authorId: string;
  authorName: string;
  /** Bilinmiyorsa null. Outlier skorunun paydası. */
  authorFollowers: number | null;
  postedAt: string; // ISO
  durationSec: number | null;
  hashtags: string[];
  /** Hangi niş sorgusundan geldi. */
  niche: string;
  /** Hangi arama terimi bulup getirdi — sorgu kalitesini ölçmek için. */
  matchedQuery: string;
  firstSeenAt: string; // ISO
};

/** Zaman içinde ölçüm. İvmeyi bundan türetiyoruz; hiçbir API vermiyor. */
export type MetricSnapshot = {
  itemId: string;
  capturedAt: string; // ISO
  views: number;
  likes: number;
  comments: number;
};

export type CollectorResult = {
  item: TrendItem;
  metrics: Omit<MetricSnapshot, 'itemId' | 'capturedAt'>;
};

export type Collector = {
  name: string;
  /** Kimlik bilgisi eksikse false döner; pipeline bunu atlar, patlamaz. */
  isConfigured(): boolean;
  collect(niche: NicheConfig): Promise<CollectorResult[]>;
};

export type NicheConfig = {
  /** Kısa slug: volleyball, fitness, couple ... */
  key: string;
  label: string;
  /** YouTube arama terimleri. */
  queries: string[];
  /** Reddit subreddit'leri (r/ olmadan). */
  subreddits: string[];
  /** TikTok/IG için hashtag'ler (faz 2). */
  hashtags: string[];
  /** Bu niş için hedef bölge (YouTube regionCode). */
  regionCode?: string;
};

/** Skorlanmış, digest'e hazır satır. */
export type ScoredItem = TrendItem & {
  views: number;
  likes: number;
  comments: number;
  /** views / takipçi — kanalına göre ne kadar sıra dışı. */
  outlierScore: number;
  /** Saatlik izlenme (ilk snapshot'tan bu yana). */
  velocityPerHour: number | null;
  /** İki snapshot arasındaki ivme değişimi; hızlanıyor mu? */
  accelerating: boolean | null;
  engagementRate: number;
  ageHours: number;
  /** Nihai sıralama skoru. */
  score: number;
  snapshotCount: number;
};
