export type GlossaryCategory = 'anomaly' | 'superstition';

export interface GlossaryEntry {
  id: string;
  category: GlossaryCategory;
  title: string;
  source: string;
  summary: string;
  unlocked: boolean;
  unlockedAt?: string;
}

export interface PlayerGlossaryNote {
  id: string;
  category: GlossaryCategory;
  title: string;
  body: string;
  createdAt: string;
}

export const INITIAL_GLOSSARY_ENTRIES: GlossaryEntry[] = [
  // Köy Yaşlılarından Duyulan Batıl İnanışlar
  {
    id: 'lore_arif_alone',
    category: 'superstition',
    title: 'Sabır Mumu ve Refakat İnancı',
    source: 'Hacı Arif Efendi’nin El Yazması',
    summary:
      'Anadolu geleneğinde cenaze gusül sırasında odada yalnız ve ışıksız bırakılmaz. Başucunda yakılan Sabır Mumu hem saygı nişanesidir hem de eşiği bekleyen karanlığı uzak tutar.',
    unlocked: false,
  },
  {
    id: 'lore_serife_window',
    category: 'superstition',
    title: 'Gece Pencereye Tıklayanın Adı',
    source: 'Şerife Nine · Eski Köy Evi',
    summary:
      'Yaşlılara göre gece yarısı camdan içeri bakan ya da dışarıdan seslenen gölgeye göz göze bakmak uğursuzluk getirir; kapı ve kepenk derhal kapatılmalıdır.',
    unlocked: false,
  },
  {
    id: 'lore_serife_water',
    category: 'superstition',
    title: 'Gece Toprağa Dökülen Su Yasağı',
    source: 'Şerife Nine · Köy Halk İnancı',
    summary:
      'Gün battıktan sonra dışarıya kirli veya sıcak su dökmek eşik altındakileri rahatsız eder. Gasilhane suyu yalnızca içteki taş gidere verilmelidir.',
    unlocked: false,
  },
  {
    id: 'lore_serife_boganak',
    category: 'superstition',
    title: 'Dere Boyundaki Mor Çiçek (Boğanak)',
    source: 'Şerife Nine · Eski Hikâyeler',
    summary:
      'Eski Su Değirmeni kıyısında biten mor çiçekli Boğanak kökü eskiden yalnızca vahşi hayvanı uyutmak için bir damla kaynatılırdı; fazlası nefesi keser.',
    unlocked: false,
  },
  {
    id: 'lore_bekci_shadows',
    category: 'superstition',
    title: 'Tipideki İki Gölge Söylencesi',
    source: 'Bekçi Hasan · Kuzdağ Devriyesi',
    summary:
      'Köylüler, 15 Kasım gecesi virajdaki minibüsten yalnızca şoförün değil, başucunda saati durmuş ikinci bir yolcunun da sisin içinde görüldüğünü anlatır.',
    unlocked: false,
  },
  {
    id: 'lore_bekci_breath',
    category: 'superstition',
    title: 'Kara Basma Gelince Işığı Üflemek',
    source: 'Bekçi Hasan · Karakol Nöbeti',
    summary:
      'Yağmur altında derinden gelen uğultu duyulduğunda elde mum taşımak hedef olmaktır; duvar dibine sinip eğilmek ve alevi söndürmek gerekir.',
    unlocked: false,
  },
  {
    id: 'lore_idris_soil',
    category: 'superstition',
    title: 'Donmuş Toprak ve Üçüncü Çukur',
    source: 'Mezarcı İdris · Mezarlık Tepesi',
    summary:
      'Mezarlıkta gece vakti kazma tutmayan sert toprak "emanetini bekleyen bir ruhun hâlâ köyde yürüdüğüne" yorulur.',
    unlocked: false,
  },

  // Karşılaşılan Anomaliler
  {
    id: 'anom_window',
    category: 'anomaly',
    title: 'Morg Camındaki Tıkırtı ve Fısıltı',
    source: 'Anomali · Gasilhane Batı Penceresi',
    summary:
      'Yıkama sırasında buzlu camın ardından soğuk bir siluet belirdi, cam mavimsi bir parıltıyla titredi ve dışarıdan boğuk fısıltılar duyuldu.',
    unlocked: false,
  },
  {
    id: 'anom_bulb',
    category: 'anomaly',
    title: 'Suyun Ardından Patlayan Ampul',
    source: 'Anomali · Gasilhane Tavanı',
    summary:
      'Kirli yıkama suyu boşaltıldığı anda tavan ampulü patladı ve oda yalnızca mum ışığına kaldı.',
    unlocked: false,
  },
  {
    id: 'anom_vigil',
    category: 'anomaly',
    title: 'Teneşirdeki Sürtünme Sesi',
    source: 'Anomali · Gasilhane İç Mekânı',
    summary:
      'Sabır Mumu olmadan ya da süresi dolduğunda mermer teneşir üzerindeki bedenin yönü hafifçe kaydı ve taş üzerinde kuru bir sürtünme sesi yankılandı.',
    unlocked: false,
  },
  {
    id: 'anom_drain',
    category: 'anomaly',
    title: 'Avlu Oluğundan Yükselen Uğultu',
    source: 'Anomali · Dış Avlu Taş Oluğu',
    summary:
      'Gece dışarı su döküldüğünde toprağın içinden soğuk bir uğultu ve rüzgâr tersine esti.',
    unlocked: false,
  },
  {
    id: 'anom_karabasma',
    category: 'anomaly',
    title: 'Kara Basma Gölgesi',
    source: 'Anomali · Yağmurlu Köy Sokakları',
    summary:
      'Mum alevini titreten, yaklaştıkça görüşü karartıp nefesi daraltan uzun pelerinli gece varlığı. Işık açıkken hızla yaklaşır.',
    unlocked: false,
  },
  {
    id: 'anom_sisgozcusu',
    category: 'anomaly',
    title: 'Sis Gözcüsü',
    source: 'Anomali · Dere Köprüsü ve Mezarlık Yolu',
    summary:
      'Batı yakasındaki dere sisi içinde süzülen solgun gözlü siluet; mezarlık tepesi ile değirmen arasında devriye gezer.',
    unlocked: false,
  },
];
