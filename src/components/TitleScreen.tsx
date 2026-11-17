import React from 'react';
import { SaveSummary } from '../game/types';

interface TitleScreenProps {
  onStart: () => void;
  onContinue: () => void;
  hasSavedGame: boolean;
  saveSummary: SaveSummary | null;
  assetLoadPercent: number;
  assetsReady: boolean;
  isMuted: boolean;
  onToggleMute: () => void;
}

export const TitleScreen: React.FC<TitleScreenProps> = ({
  onStart,
  onContinue,
  hasSavedGame,
  saveSummary,
  assetLoadPercent,
  assetsReady,
  isMuted,
  onToggleMute,
}) => {
  const completedAutopsies = saveSummary?.completedAutopsies ?? 0;
  const discoveredClues = saveSummary?.discoveredClues ?? 0;
  const activeGoal = saveSummary ? saveSummary.actTitle : 'GASSALHANE HAZIRLIK';

  return (
    <div
      className="fixed inset-0 z-20 grid grid-rows-[auto_1fr_auto] text-[#e2d9c8]"
      style={{
        background:
          'radial-gradient(circle at 50% 48%, rgba(140, 29, 24, 0.08) 0%, rgba(12, 13, 15, 0.72) 66%, rgba(7, 8, 10, 0.92) 100%)',
      }}
    >
      {/* Top Header */}
      <header className="px-6 md:px-12 py-6 md:py-7 flex items-center justify-between gap-6 border-b border-[#e2d9c8]/10">
        <span className="font-mono-tech text-[11px] uppercase tracking-[0.25em] text-[#8c8174] whitespace-nowrap shrink-0">
          KUZDAĞ KÖYÜ · RAKIM 1480m
        </span>

        <div className="flex items-center gap-4 shrink-0">
          {!assetsReady && (
            <span className="font-mono-tech text-[11px] uppercase tracking-[0.16em] text-[#c79e59] tabular-nums whitespace-nowrap">
              3B Köy Paketleri Yükleniyor %{assetLoadPercent}
            </span>
          )}
          <button
            type="button"
            onClick={onToggleMute}
            className="font-mono-tech text-[11px] uppercase tracking-[0.18em] px-4 py-2 border border-[#e2d9c8]/20 bg-[#0c0d0f]/70 text-[#b4aa9a] hover:text-[#e2d9c8] hover:border-[#8c1d18] transition-colors cursor-pointer whitespace-nowrap shrink-0"
          >
            {isMuted ? 'SES KAPALI' : 'SES AÇIK'}
          </button>
        </div>
      </header>

      {/* Main Split Editorial Layout */}
      <main className="px-6 md:px-12 py-6 grid grid-cols-1 lg:grid-cols-[1fr_420px] items-center gap-8 lg:gap-16 overflow-y-auto lg:overflow-hidden">
        <div className="max-w-xl">
          <span className="font-mono-tech block text-xs uppercase tracking-[0.28em] text-[#b8322c] mb-4">
            ANADOLU HALK İNANIŞLARI VE ADLİ OTOPSİ
          </span>

          <h1 className="font-display font-bold uppercase text-white leading-[0.86] tracking-[-0.03em] text-[clamp(4.25rem,9vw,8.5rem)] mb-7">
            SON
            <br />
            VAZİFE
          </h1>

          <p className="text-base md:text-lg font-light leading-relaxed text-[#e2d9c8]/75 max-w-[500px] mb-9">
            Köyün son gassalı vefat etti. Dağ vadisinin beş farklı bölgesinde tanıkları dinle,
            üç ayrı cenazenin adli otopsi bulgularını çöz ve halk inanışlarını çiğnemeden son
            vazifeyi tamamla.
          </p>

          <div className="flex flex-wrap items-center gap-4">
            {hasSavedGame && saveSummary ? (
              <>
                <button
                  type="button"
                  onClick={onContinue}
                  className="font-mono-tech px-7 py-4 bg-[#8c1d18] hover:bg-[#a6231d] text-white text-xs font-medium uppercase tracking-[0.16em] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  KALDIĞIN YERDEN DEVAM ET
                </button>
                <button
                  type="button"
                  onClick={onStart}
                  className="font-mono-tech px-7 py-4 bg-[#0c0d0f]/60 border border-[#e2d9c8]/25 hover:border-[#e2d9c8]/60 text-[#e2d9c8] text-xs font-medium uppercase tracking-[0.16em] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  YENİ GÖREV
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  onClick={onStart}
                  className="font-mono-tech px-8 py-4 bg-[#8c1d18] hover:bg-[#a6231d] text-white text-xs font-medium uppercase tracking-[0.18em] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                >
                  GÖREVE BAŞLA
                </button>
                <span className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-[#8c8174]">
                  [Enter] veya [Boşluk]
                </span>
              </>
            )}
          </div>

          {hasSavedGame && saveSummary && (
            <p className="font-mono-tech mt-5 text-[11px] uppercase tracking-[0.12em] text-[#8c8174] tabular-nums">
              Son Kayıt: {saveSummary.actTitle} · Saat {saveSummary.savedAt} · Otopsi{' '}
              {completedAutopsies}/3 · Belge {discoveredClues}
            </p>
          )}
        </div>

        {/* Right Editorial Case Dossier Column */}
        <div className="lg:h-[52vh] border-t lg:border-t-0 lg:border-l border-[#e2d9c8]/10 pt-6 lg:pt-0 lg:pl-14 flex flex-col justify-center">
          <div className="border-b border-[#e2d9c8]/10 py-5">
            <span className="font-mono-tech block text-[11px] uppercase tracking-[0.18em] text-[#8c8174] mb-1.5">
              OTOPSİ DURUMU
            </span>
            <span className="font-display text-2xl text-[#e2d9c8] tabular-nums">
              {completedAutopsies === 0
                ? 'TAMAMLANMADI [0/3]'
                : completedAutopsies < 3
                  ? `DEVAM EDİYOR [${completedAutopsies}/3]`
                  : 'TÜMÜ MÜHÜRLENDİ [3/3]'}
            </span>
          </div>

          <div className="border-b border-[#e2d9c8]/10 py-5">
            <span className="font-mono-tech block text-[11px] uppercase tracking-[0.18em] text-[#8c8174] mb-1.5">
              BULUNAN BELGELER
            </span>
            <span className="font-display text-2xl text-[#e2d9c8] tabular-nums">
              {discoveredClues === 0 ? 'HENÜZ YOK [0]' : `${discoveredClues} ADET KANIT`}
            </span>
          </div>

          <div className="py-5">
            <span className="font-mono-tech block text-[11px] uppercase tracking-[0.18em] text-[#8c8174] mb-1.5">
              GÜNCEL HEDEF
            </span>
            <span className="font-display text-2xl text-[#e2d9c8]">{activeGoal}</span>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="px-6 md:px-12 py-5 border-t border-[#e2d9c8]/10 flex flex-wrap justify-between items-center gap-4">
        <div className="font-mono-tech text-[11px] tracking-[0.08em] text-[#8c8174] uppercase">
          WASD Hareket · Shift Koş · C Eğil · Fare / Sağ Tık Odak · E / Sol Tık Etkileşim &amp;
          Otopsi · F Mum · Tab Defter &amp; Harita · M Ses · Esc Duraklat
        </div>
        <div className="font-mono-tech text-[10px] tracking-[0.22em] text-[#6e6459] uppercase whitespace-nowrap">
          KUZDAĞ ARŞİVİ · ANADOLU PSİKOLOJİK KORKU
        </div>
      </footer>
    </div>
  );
};
