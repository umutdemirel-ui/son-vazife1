import React, { useState } from 'react';
import {
  AutopsyCaseId,
  AutopsyCaseState,
  AutopsyZoneId,
  ClueDocument,
  DistrictId,
  FolkloreRule,
  GlossaryCategory,
  GlossaryEntry,
  InventoryItem,
  PlayerGlossaryNote,
} from '../game/types';

interface NotebookModalProps {
  rules: FolkloreRule[];
  clues: ClueDocument[];
  inventory: InventoryItem[];
  autopsyCases: Record<AutopsyCaseId, AutopsyCaseState>;
  discoveredDistricts: DistrictId[];
  playerMapPos: { x: number; z: number; yaw: number };
  glossaryEntries: GlossaryEntry[];
  playerGlossaryNotes: PlayerGlossaryNote[];
  onAddGlossaryNote: (title: string, category: GlossaryCategory, body: string) => void;
  onDeleteGlossaryNote: (noteId: string) => void;
  onClose: () => void;
}

type NotebookTab = 'rules' | 'clues' | 'autopsy' | 'glossary' | 'map';
type GlossaryFilter = 'all' | 'anomaly' | 'superstition' | 'notes';

const MAP_LANDMARKS: Array<{
  id: DistrictId;
  name: string;
  sub: string;
  x: number;
  z: number;
}> = [
  { id: 'square', name: 'Köy Meydanı & Gasilhane', sub: 'Cami · Çeşme · Muhtarlık', x: 0, z: 4 },
  { id: 'clinic', name: 'Sağlık Ocağı', sub: 'Vaka II · Şoför Mahmut', x: 26, z: -28 },
  { id: 'mill', name: 'Eski Su Değirmeni', sub: 'Dere Köprüsü · Boğanak', x: -36, z: 8 },
  { id: 'cemetery', name: 'Mezarlık & Taş Mahzen', sub: 'Vaka III · Mezarcı İdris', x: -34, z: -36 },
  { id: 'crash_site', name: 'Viraj Kaza Alanı', sub: '22:40 Minibüs Enkazı', x: 28, z: 20 },
];

export const NotebookModal: React.FC<NotebookModalProps> = ({
  rules,
  clues,
  inventory,
  autopsyCases,
  discoveredDistricts,
  playerMapPos,
  glossaryEntries,
  playerGlossaryNotes,
  onAddGlossaryNote,
  onDeleteGlossaryNote,
  onClose,
}) => {
  const [tab, setTab] = useState<NotebookTab>('rules');
  const [glossaryFilter, setGlossaryFilter] = useState<GlossaryFilter>('all');
  const [noteTitle, setNoteTitle] = useState('');
  const [noteCategory, setNoteCategory] = useState<GlossaryCategory>('superstition');
  const [noteBody, setNoteBody] = useState('');

  const discoveredClues = clues.filter((c) => c.discovered);
  const unlockedGlossaryCount = glossaryEntries.filter((g) => g.unlocked).length;

  const handleNoteSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteTitle.trim() || !noteBody.trim()) return;
    onAddGlossaryNote(noteTitle, noteCategory, noteBody);
    setNoteTitle('');
    setNoteBody('');
  };

  // Convert world coords x:[-48..42], z:[-52..44] -> SVG 0..420 x 0..320
  const toSvgX = (wx: number) => ((wx + 48) / 90) * 420;
  const toSvgY = (wz: number) => ((wz + 52) / 96) * 320;

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center p-4 bg-[#060709]/82">
      <div className="relative w-full max-w-4xl max-h-[88vh] overflow-y-auto notebook-paper text-[#221a12] shadow-2xl border-2 border-[#6b5539] p-6 md:p-9">
        {/* Header */}
        <div className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#7d6547]/50 pb-4 mb-4">
          <div>
            <p className="text-xs uppercase tracking-[0.25em] text-[#5c4730] font-semibold">
              Hacı Arif Efendi · El Yazması & Adli Cetvel
            </p>
            <h2 className="font-hand text-4xl font-bold text-[#1f160d] mt-1">
              Gassalın Defteri
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 text-xs font-semibold tracking-wider uppercase bg-[#2a2016] text-[#eadec8] hover:bg-[#3e2f20] cursor-pointer"
          >
            Kapat [Tab]
          </button>
        </div>

        {/* Navigation Tabs */}
        <div className="flex flex-wrap gap-2 border-b border-[#7d6547]/40 pb-3 mb-6 text-xs uppercase tracking-wider font-semibold">
          {(
            [
              { id: 'rules', label: 'Kurallar & Malzemeler' },
              { id: 'clues', label: `Belgeler (${discoveredClues.length}/${clues.length})` },
              { id: 'autopsy', label: 'Otopsi Dosyaları' },
              {
                id: 'glossary',
                label: `İnanışlar Sözlüğü (${unlockedGlossaryCount + playerGlossaryNotes.length})`,
              },
              { id: 'map', label: 'Köy Haritası' },
            ] as Array<{ id: NotebookTab; label: string }>
          ).map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 border cursor-pointer transition-colors ${
                tab === t.id
                  ? 'bg-[#2a2016] border-[#2a2016] text-[#f2e7d3]'
                  : 'bg-[#d5c5a3]/50 border-[#8c7353]/60 text-[#3c2d1d] hover:bg-[#c8b38b]/70'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'rules' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div>
              <h3 className="font-display text-sm font-bold tracking-[0.18em] uppercase text-[#4b3824] mb-3">
                Köyün Kuralları ve Yasaklar
              </h3>
              <div className="divide-y divide-[#8c7556]/35">
                {rules.map((rule) => (
                  <div
                    key={rule.id}
                    className={`py-3 px-2.5 ${
                      rule.violated ? 'bg-[#8c1d18]/12' : 'bg-transparent'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-hand text-xl font-bold text-[#20160d]">
                        {rule.number}. {rule.title}
                      </span>
                      {rule.violated && (
                        <span className="text-[11px] font-bold uppercase tracking-wider text-[#8c1d18]">
                          İHLAL EDİLDİ
                        </span>
                      )}
                    </div>
                    <p className="font-hand text-lg leading-snug text-[#342618] mt-1">
                      {rule.text}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div>
              <h3 className="font-display text-sm font-bold tracking-[0.18em] uppercase text-[#4b3824] mb-3">
                Malzemeler & Anahtarlar
              </h3>
              <ul className="space-y-2">
                {inventory.map((item) => (
                  <li
                    key={item.id}
                    className="flex items-start gap-2.5 text-sm border-b border-[#8c7556]/30 pb-1.5"
                  >
                    <span
                      className={`mt-0.5 inline-block w-4 h-4 text-center leading-4 text-xs font-bold border ${
                        item.collected
                          ? 'bg-[#2f452d] border-[#2f452d] text-[#f2ebd9]'
                          : 'border-[#6d573d] text-transparent'
                      }`}
                    >
                      ✓
                    </span>
                    <div>
                      <div
                        className={`font-semibold ${
                          item.collected ? 'text-[#1c150e]' : 'text-[#6c5b47]'
                        }`}
                      >
                        {item.name}
                      </div>
                      <div className="text-xs text-[#544230]">{item.description}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {tab === 'clues' && (
          <div>
            <h3 className="font-display text-sm font-bold tracking-[0.18em] uppercase text-[#4b3824] mb-3">
              Bulunan Belgeler, Tutanaklar ve İpuçları ({discoveredClues.length}/{clues.length})
            </h3>
            {discoveredClues.length === 0 ? (
              <p className="font-hand text-lg italic text-[#5c4935]">
                Henüz köy evlerinden, değirmenden veya muhtarlıktan bir belge incelenmedi.
              </p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {discoveredClues.map((clue) => (
                  <div
                    key={clue.id}
                    className="p-3.5 bg-[#ede4cf]/70 border border-[#8e7657]/55"
                  >
                    <div className="text-xs uppercase tracking-wider text-[#6a5239] font-semibold">
                      {clue.subtitle}
                    </div>
                    <div className="font-hand text-xl font-bold text-[#1d140b]">
                      {clue.title}
                    </div>
                    <p className="font-hand text-lg leading-snug text-[#2e2115] mt-1">
                      {clue.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'autopsy' && (
          <div className="space-y-4">
            <h3 className="font-display text-sm font-bold tracking-[0.18em] uppercase text-[#4b3824]">
              Adli Otopsi Vaka Dosyaları
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {(Object.keys(autopsyCases) as AutopsyCaseId[]).map((cid) => {
                const c = autopsyCases[cid];
                const zonesFound = (Object.values(c.zones) as Array<AutopsyCaseState['zones'][AutopsyZoneId]>).filter(
                  (z) => z.externalFound,
                );
                return (
                  <div
                    key={cid}
                    className="p-3.5 bg-[#ede4cf]/65 border border-[#8e7657]/60 flex flex-col justify-between"
                  >
                    <div>
                      <div className="flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-[#5e4a35]">
                        <span>{c.locationLabel}</span>
                        <span className={c.completed ? 'text-[#2b5835]' : 'text-[#7c5328]'}>
                          {c.completed ? 'Mühürlü' : c.unlocked ? 'Açık' : 'Kilitli'}
                        </span>
                      </div>
                      <h4 className="font-hand text-2xl font-bold text-[#1d140b] mt-1">
                        {c.victimName}
                      </h4>
                      <div className="mt-2 space-y-1.5 text-xs text-[#3b2c1d]">
                        {zonesFound.length === 0 ? (
                          <p className="italic text-[#6a5843]">Henüz muayene yapılmadı.</p>
                        ) : (
                          zonesFound.map((z) => (
                            <div key={z.zone} className="border-t border-[#8c7556]/25 pt-1">
                              <span className="font-semibold">{z.zoneLabel}:</span> {z.externalNote}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                    {c.completed && (
                      <div className="mt-3 pt-2 border-t border-[#7d6547]/45 text-xs font-semibold text-[#233d28]">
                        Karar: {c.selectedCause} ({c.selectedTime})
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {tab === 'glossary' && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#8c7556]/40 pb-3">
              <div>
                <h3 className="font-display text-sm font-bold tracking-[0.18em] uppercase text-[#4b3824]">
                  İnanışlar ve Anomaliler Sözlüğü
                </h3>
                <p className="text-xs text-[#574531] mt-0.5">
                  Köy yaşlılarından duyulan batıl inanışlar, karşılaşılan anomaliler ve kendi saha notların.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5 text-[11px] font-semibold uppercase tracking-wider">
                {(
                  [
                    { id: 'all', label: 'Tümü' },
                    { id: 'anomaly', label: 'Anomaliler' },
                    { id: 'superstition', label: 'Batıl İnanışlar' },
                    { id: 'notes', label: `Notlarım (${playerGlossaryNotes.length})` },
                  ] as Array<{ id: GlossaryFilter; label: string }>
                ).map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setGlossaryFilter(f.id)}
                    className={`px-2.5 py-1 border cursor-pointer transition-colors ${
                      glossaryFilter === f.id
                        ? 'bg-[#2a2016] border-[#2a2016] text-[#f2e7d3]'
                        : 'bg-[#ede4cf]/70 border-[#8c7353]/60 text-[#3c2d1d] hover:bg-[#d8c7a7]'
                    }`}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left: Personal Note Composer */}
              <form
                onSubmit={handleNoteSubmit}
                className="lg:col-span-4 p-4 bg-[#ede4cf]/80 border border-[#8c7353]/65 space-y-3"
              >
                <div className="text-xs font-display font-bold uppercase tracking-[0.16em] text-[#3d2d1d]">
                  Kişisel Sözlük Notu Ekle
                </div>

                <div>
                  <label className="block text-[11px] uppercase tracking-wider font-semibold text-[#5b4732] mb-1">
                    Kategori
                  </label>
                  <div className="grid grid-cols-2 gap-1.5 text-xs font-semibold">
                    <button
                      type="button"
                      onClick={() => setNoteCategory('superstition')}
                      className={`py-1.5 border cursor-pointer ${
                        noteCategory === 'superstition'
                          ? 'bg-[#2a2016] border-[#2a2016] text-[#f2e7d3]'
                          : 'bg-[#dfd2b5]/70 border-[#8c7353]/60 text-[#3c2d1d]'
                      }`}
                    >
                      Batıl İnanış
                    </button>
                    <button
                      type="button"
                      onClick={() => setNoteCategory('anomaly')}
                      className={`py-1.5 border cursor-pointer ${
                        noteCategory === 'anomaly'
                          ? 'bg-[#6b1d18] border-[#6b1d18] text-[#f7ece7]'
                          : 'bg-[#dfd2b5]/70 border-[#8c7353]/60 text-[#3c2d1d]'
                      }`}
                    >
                      Anomali
                    </button>
                  </div>
                </div>

                <div>
                  <label
                    htmlFor="glossary-note-title"
                    className="block text-[11px] uppercase tracking-wider font-semibold text-[#5b4732] mb-1"
                  >
                    Başlık / Kavram
                  </label>
                  <input
                    id="glossary-note-title"
                    type="text"
                    maxLength={70}
                    value={noteTitle}
                    onChange={(e) => setNoteTitle(e.target.value)}
                    placeholder="Örn: Dere kıyısındaki fısıltı..."
                    className="w-full px-2.5 py-1.5 text-sm bg-[#f7f1e1] border border-[#8c7353]/70 text-[#1f160d] placeholder:text-[#86725a] focus:outline-none focus:border-[#3d2d1d]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="glossary-note-body"
                    className="block text-[11px] uppercase tracking-wider font-semibold text-[#5b4732] mb-1"
                  >
                    Gözlem veya Duyulan İnanış
                  </label>
                  <textarea
                    id="glossary-note-body"
                    rows={4}
                    maxLength={360}
                    value={noteBody}
                    onChange={(e) => setNoteBody(e.target.value)}
                    placeholder="Yaşlılardan duyduğun sözü ya da karşılaştığın tuhaflığı buraya kaydet..."
                    className="w-full px-2.5 py-1.5 text-sm bg-[#f7f1e1] border border-[#8c7353]/70 text-[#1f160d] placeholder:text-[#86725a] focus:outline-none focus:border-[#3d2d1d] resize-y"
                  />
                </div>

                <button
                  type="submit"
                  disabled={!noteTitle.trim() || !noteBody.trim()}
                  className="w-full py-2 text-xs font-semibold uppercase tracking-wider bg-[#2a2016] text-[#f2e7d3] hover:bg-[#3f3021] disabled:opacity-45 disabled:cursor-not-allowed cursor-pointer transition-colors"
                >
                  Sözlüğe Kaydet
                </button>
              </form>

              {/* Right: Player Notes & Auto-Discovered Lore/Anomalies */}
              <div className="lg:col-span-8 space-y-5">
                {(glossaryFilter === 'all' || glossaryFilter === 'notes') && (
                  <div>
                    <div className="text-xs font-display font-bold uppercase tracking-[0.16em] text-[#4b3824] mb-2">
                      Senin Notların ({playerGlossaryNotes.length})
                    </div>
                    {playerGlossaryNotes.length === 0 ? (
                      <p className="font-hand text-lg italic text-[#67543f] border-b border-[#8c7556]/30 pb-3">
                        Henüz kendi elinle eklediğin bir not yok. Sol taraftan gözlemlerini yazabilirsin.
                      </p>
                    ) : (
                      <div className="divide-y divide-[#8c7556]/35 border-t border-b border-[#8c7556]/40">
                        {playerGlossaryNotes.map((note) => (
                          <div key={note.id} className="py-2.5 px-1">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider font-semibold">
                                  <span
                                    className={
                                      note.category === 'anomaly'
                                        ? 'text-[#7c1d18]'
                                        : 'text-[#3c4d32]'
                                    }
                                  >
                                    {note.category === 'anomaly' ? 'Anomali Notu' : 'Batıl İnanış Notu'}
                                  </span>
                                  <span className="text-[#78634c]">· {note.createdAt}</span>
                                </div>
                                <div className="font-hand text-xl font-bold text-[#1f160d]">
                                  {note.title}
                                </div>
                              </div>
                              <button
                                type="button"
                                onClick={() => onDeleteGlossaryNote(note.id)}
                                className="text-[11px] uppercase tracking-wider text-[#7c1d18] hover:underline cursor-pointer shrink-0"
                              >
                                Sil
                              </button>
                            </div>
                            <p className="font-hand text-lg leading-snug text-[#2f2215] mt-0.5">
                              {note.body}
                            </p>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {glossaryFilter !== 'notes' && (
                  <div>
                    <div className="text-xs font-display font-bold uppercase tracking-[0.16em] text-[#4b3824] mb-2">
                      Derlenen Köy İnanışları ve Anomaliler ({unlockedGlossaryCount}/{glossaryEntries.length})
                    </div>
                    <div className="divide-y divide-[#8c7556]/35 border-t border-b border-[#8c7556]/40">
                      {glossaryEntries
                        .filter((entry) =>
                          glossaryFilter === 'all' ? true : entry.category === glossaryFilter,
                        )
                        .map((entry) => (
                          <div
                            key={entry.id}
                            className={`py-3 px-2 ${
                              entry.unlocked
                                ? entry.category === 'anomaly'
                                  ? 'bg-[#8c1d18]/8'
                                  : 'bg-[#ede4cf]/45'
                                : 'opacity-65'
                            }`}
                          >
                            <div className="flex flex-wrap items-center justify-between gap-2 text-[10px] uppercase tracking-wider font-semibold">
                              <span
                                className={
                                  entry.category === 'anomaly'
                                    ? 'text-[#7c1d18]'
                                    : 'text-[#435334]'
                                }
                              >
                                {entry.category === 'anomaly' ? 'Anomali' : 'Batıl İnanış'}
                                {' · '}
                                {entry.unlocked ? entry.source : 'Kayıt Henüz Açılmadı'}
                              </span>
                              <span className="text-[#695640]">
                                {entry.unlocked
                                  ? entry.unlockedAt
                                    ? `Kaydedildi (${entry.unlockedAt})`
                                    : 'Öğrenildi'
                                  : 'Kilitli'}
                              </span>
                            </div>
                            <div className="font-hand text-xl font-bold text-[#1f160d] mt-0.5">
                              {entry.unlocked
                                ? entry.title
                                : entry.category === 'anomaly'
                                  ? 'Bilinmeyen Gece Anomalisi'
                                  : 'Duyulmamış Köy İnanışı'}
                            </div>
                            <p className="font-hand text-lg leading-snug text-[#322417] mt-0.5">
                              {entry.unlocked
                                ? entry.summary
                                : entry.category === 'anomaly'
                                  ? 'Gece vardiyasında bu tuhaflıkla doğrudan karşılaştığında deftere işlenecek.'
                                  : 'Köydeki yaşlılarla (Bekçi Hasan, Şerife Nine, Mezarcı İdris) konuşarak öğren.'}
                            </p>
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {tab === 'map' && (
          <div className="grid grid-cols-1 md:grid-cols-5 gap-6 items-start">
            <div className="md:col-span-3 bg-[#dfd1b2] border border-[#7d6547] p-3">
              <svg viewBox="0 0 420 320" className="w-full h-auto">
                {/* Stream line at x ≈ -24 */}
                <path
                  d={`M ${toSvgX(-24)} 0 Q ${toSvgX(-22)} 160 ${toSvgX(-25)} 320`}
                  fill="none"
                  stroke="#4d7384"
                  strokeWidth="8"
                  opacity="0.7"
                />
                {/* Main north-south road */}
                <line
                  x1={toSvgX(0)}
                  y1={12}
                  x2={toSvgX(0)}
                  y2={305}
                  stroke="#745f44"
                  strokeWidth="6"
                />
                {/* Branch to Clinic */}
                <line
                  x1={toSvgX(0)}
                  y1={toSvgY(-24)}
                  x2={toSvgX(26)}
                  y2={toSvgY(-28)}
                  stroke="#745f44"
                  strokeWidth="4.5"
                />
                {/* Branch to Cemetery */}
                <line
                  x1={toSvgX(0)}
                  y1={toSvgY(-29)}
                  x2={toSvgX(-34)}
                  y2={toSvgY(-36)}
                  stroke="#745f44"
                  strokeWidth="4.5"
                />
                {/* Branch to Mill & Bridge */}
                <line
                  x1={toSvgX(0)}
                  y1={toSvgY(8)}
                  x2={toSvgX(-36)}
                  y2={toSvgY(8)}
                  stroke="#745f44"
                  strokeWidth="4.5"
                />
                {/* Branch to Crash Site */}
                <line
                  x1={toSvgX(0)}
                  y1={toSvgY(16)}
                  x2={toSvgX(28)}
                  y2={toSvgY(20)}
                  stroke="#745f44"
                  strokeWidth="4.5"
                />

                {/* Landmark pins */}
                {MAP_LANDMARKS.map((lm) => {
                  const seen = discoveredDistricts.includes(lm.id);
                  const px = toSvgX(lm.x);
                  const py = toSvgY(lm.z);
                  return (
                    <g key={lm.id}>
                      <circle
                        cx={px}
                        cy={py}
                        r="7"
                        fill={seen ? '#2f452d' : '#7c6b53'}
                        stroke="#1f160d"
                        strokeWidth="1.5"
                      />
                      <text
                        x={px}
                        y={py - 12}
                        textAnchor="middle"
                        fontSize="10"
                        fontWeight="bold"
                        fill="#1f160d"
                      >
                        {lm.name.split('&')[0].trim()}
                      </text>
                    </g>
                  );
                })}

                {/* Live Player Marker */}
                <g transform={`translate(${toSvgX(playerMapPos.x)}, ${toSvgY(playerMapPos.z)})`}>
                  <circle r="6" fill="#9e241b" stroke="#f7ebd2" strokeWidth="2" />
                </g>
              </svg>
            </div>

            <div className="md:col-span-2 space-y-2.5 text-xs">
              <h3 className="font-display text-sm font-bold tracking-[0.16em] uppercase text-[#4b3824] mb-2">
                Kuzdağ 5 Bölge Krokisi
              </h3>
              {MAP_LANDMARKS.map((lm) => {
                const seen = discoveredDistricts.includes(lm.id);
                return (
                  <div key={lm.id} className="border-b border-[#8c7556]/35 pb-2">
                    <div className="flex items-center justify-between font-bold text-[#1f160d]">
                      <span>{lm.name}</span>
                      <span className={seen ? 'text-[#2b5835]' : 'text-[#73624c]'}>
                        {seen ? 'Keşfedildi' : 'Uzak'}
                      </span>
                    </div>
                    <div className="text-[#4f3d2b]">{lm.sub}</div>
                  </div>
                );
              })}
              <p className="text-[11px] text-[#5c4730] pt-1">
                Kırmızı nokta şu anki konumunu gösterir. Batıdaki dere üzerinden ahşap köprüyle değirmene geçilir.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
