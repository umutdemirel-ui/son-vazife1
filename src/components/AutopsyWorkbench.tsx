import React from 'react';
import { AUTOPSY_DIAGNOSIS } from '../game/autopsy';
import {
  AutopsyCameraAngle,
  AutopsyCaseId,
  AutopsyCaseState,
  AutopsyTool,
  AutopsyZoneId,
} from '../game/types';

interface AutopsyWorkbenchProps {
  caseState: AutopsyCaseState;
  activeTool: AutopsyTool;
  activeCameraAngle: AutopsyCameraAngle;
  cameraFlashAlpha: number;
  captionText: string | null;
  onSelectTool: (tool: AutopsyTool) => void;
  onSelectCameraAngle: (angle: AutopsyCameraAngle) => void;
  onTagAnomaly: (caseId: AutopsyCaseId, anomalyId: string, tag: string) => void;
  onLinkAnomaly: (caseId: AutopsyCaseId, anomalyId: string, zoneId: AutopsyZoneId | '') => void;
  onUpdateSelection: (caseId: AutopsyCaseId, cause: string, time: string) => void;
  onSubmitDiagnosis: (caseId: AutopsyCaseId) => void;
  onExit: () => void;
}

const TOOL_ITEMS: Array<{ id: AutopsyTool; keyHint: string; label: string; desc: string }> = [
  { id: 'magnifier', keyHint: '1', label: 'Büyüteç', desc: 'Dış muayene ve yara izi tespiti' },
  { id: 'scalpel', keyHint: '2', label: 'Neşter', desc: 'Boyun veya göğüs boşluğu kesisi' },
  { id: 'forceps', keyHint: '3', label: 'Forseps', desc: 'Toksikoloji / fiziksel kanıt çıkar' },
  { id: 'camera', keyHint: '4', label: 'Fotoğraf Makinesi', desc: 'Çevresel anomalileri fotoğrafla' },
];

const CAMERA_ANGLES: Array<{ id: AutopsyCameraAngle; label: string }> = [
  { id: 'overview', label: 'Masa Üstü' },
  { id: 'floor', label: 'Zemin & İzler' },
  { id: 'perimeter', label: 'Oda Çevresi' },
];

const ZONE_ORDER: AutopsyZoneId[] = ['head', 'neck', 'chest', 'hands', 'pocket'];

export const AutopsyWorkbench: React.FC<AutopsyWorkbenchProps> = ({
  caseState,
  activeTool,
  activeCameraAngle,
  cameraFlashAlpha,
  captionText,
  onSelectTool,
  onSelectCameraAngle,
  onTagAnomaly,
  onLinkAnomaly,
  onUpdateSelection,
  onSubmitDiagnosis,
  onExit,
}) => {
  const diag = AUTOPSY_DIAGNOSIS[caseState.id];
  const anomalies = Object.values(caseState.anomalies || {});
  const photographedCount = anomalies.filter((a) => a.photographed).length;

  return (
    <div className="fixed inset-0 z-30 pointer-events-none flex flex-col justify-between p-4 md:p-6">
      {/* Camera Flash Effect */}
      {cameraFlashAlpha > 0.01 && (
        <div
          className="fixed inset-0 z-40 pointer-events-none bg-[#fffaf0]"
          style={{ opacity: Math.min(0.85, cameraFlashAlpha) }}
        />
      )}

      {/* Optical Viewfinder Overlay when Camera Tool is Active */}
      {activeTool === 'camera' && (
        <div className="fixed inset-8 md:inset-14 z-20 pointer-events-none">
          <div className="absolute top-0 left-0 w-7 h-7 border-t-2 border-l-2 border-[#8eb8ca]/80" />
          <div className="absolute top-0 right-0 w-7 h-7 border-t-2 border-r-2 border-[#8eb8ca]/80" />
          <div className="absolute bottom-0 left-0 w-7 h-7 border-b-2 border-l-2 border-[#8eb8ca]/80" />
          <div className="absolute bottom-0 right-0 w-7 h-7 border-b-2 border-r-2 border-[#8eb8ca]/80" />
          <div className="absolute bottom-2 left-3 text-[10px] uppercase tracking-[0.22em] text-[#8eb8ca]/85 tabular-nums">
            OLAY YERİ VİZÖRÜ · 35MM · {photographedCount}/{anomalies.length} ÇEKİM
          </div>
        </div>
      )}

      {/* Top Bar: Case Info, Camera Angles & Tool Selector */}
      <div className="relative z-30 flex flex-wrap items-start justify-between gap-4">
        <div className="pointer-events-auto bg-[#0c0e13]/94 border border-[#4a4133] px-4 py-3 max-w-md space-y-2">
          <div>
            <div className="text-[10px] uppercase tracking-[0.22em] text-[#8eb8ca] font-semibold">
              Adli Otopsi & Olay Yeri · {caseState.locationLabel}
            </div>
            <h2 className="font-display text-lg md:text-xl text-[#efe7d6] mt-0.5">
              {caseState.victimName}
            </h2>
            <p className="text-xs text-[#a59c8b] mt-1">
              [1–3] ile bedeni muayene et, [4] Fotoğraf Makinesi ve kamera açılarıyla çevredeki anomalileri çek.
            </p>
          </div>

          <div className="pt-1.5 border-t border-[#29241c] flex flex-wrap items-center gap-1.5">
            <span className="text-[10px] uppercase tracking-[0.16em] text-[#9b9282] mr-1">
              Kamera Açısı:
            </span>
            {CAMERA_ANGLES.map((ang) => {
              const active = activeCameraAngle === ang.id;
              return (
                <button
                  key={ang.id}
                  type="button"
                  onClick={() => onSelectCameraAngle(ang.id)}
                  className={`px-2.5 py-1 text-[11px] border cursor-pointer transition-colors ${
                    active
                      ? 'border-[#8eb8ca] bg-[#16222b] text-[#e6f3f8]'
                      : 'border-[#353027] bg-[#12151b] text-[#a79e8d] hover:border-[#6a8391]'
                  }`}
                >
                  {ang.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="pointer-events-auto flex flex-wrap items-center gap-2">
          {TOOL_ITEMS.map((t) => {
            const active = activeTool === t.id;
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelectTool(t.id)}
                title={t.desc}
                className={`px-3 py-2 text-left border cursor-pointer transition-colors ${
                  active
                    ? t.id === 'camera'
                      ? 'border-[#8eb8ca] bg-[#16222b] text-[#e6f3f8]'
                      : 'border-[#c79e59] bg-[#2a2114] text-[#f7e7c4]'
                    : 'border-[#3a342a] bg-[#0e1116]/94 text-[#c5bca9] hover:border-[#826c48]'
                }`}
              >
                <div className="text-[10px] uppercase tracking-[0.16em] text-[#9b9282]">
                  [{t.keyHint}] Alet
                </div>
                <div className="text-xs font-semibold tracking-wide">{t.label}</div>
              </button>
            );
          })}

          <button
            type="button"
            onClick={onExit}
            className="px-3.5 py-3 text-xs uppercase tracking-wider border border-[#4a3f31] bg-[#12141a]/95 text-[#dfd6c5] hover:border-[#c79e59] cursor-pointer"
          >
            Masadan Ayrıl [Esc]
          </button>
        </div>
      </div>

      {/* Right Side Forensic Clipboard */}
      <div className="relative z-30 my-auto ml-auto pointer-events-auto w-full max-w-sm max-h-[68vh] overflow-y-auto bg-[#0c0e13]/95 border border-[#4d4334] p-4 space-y-4">
        <div>
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#c79e59] font-semibold pb-1.5 border-b border-[#2c261f]">
            Anatomik Muayene Bulguları
          </h3>
          <div className="divide-y divide-[#25211b] mt-1">
            {ZONE_ORDER.map((zId) => {
              const z = caseState.zones[zId];
              return (
                <div key={zId} className="py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#eae1ce]">{z.zoneLabel}</span>
                    <span
                      className={`text-[10px] uppercase tracking-wider ${
                        z.externalFound ? 'text-[#89b994]' : 'text-[#7e776a]'
                      }`}
                    >
                      {z.externalFound ? 'İncelendi' : 'Bekliyor'}
                    </span>
                  </div>
                  {z.externalFound && (
                    <p className="text-[#bfb5a2] mt-1 leading-snug">{z.externalNote}</p>
                  )}
                  {z.incised && z.internalNote && (
                    <p className="text-[#d99d8d] mt-1 leading-snug">
                      Kesi Bulgusu: {z.internalNote}
                    </p>
                  )}
                  {z.sampleExtracted && z.sampleItemName && (
                    <p className="text-[#e3c178] mt-1 font-medium">
                      Alınan Kanıt: {z.sampleItemName}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Crime Scene Investigation & Cross-Reference Layer */}
        <div className="pt-2 border-t border-[#2c261f] space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#8eb8ca] font-semibold">
              Olay Yeri Kanıtları & Eşleştirme
            </h3>
            <span className="text-[10px] tabular-nums text-[#9e9585]">
              {photographedCount}/{anomalies.length}
            </span>
          </div>

          <div className="space-y-3">
            {anomalies.map((anom) => (
              <div
                key={anom.id}
                className="border border-[#2a2720] bg-[#11141a] p-2.5 space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-[#eae1ce]">{anom.label}</span>
                  <span
                    className={`text-[10px] uppercase tracking-wider ${
                      anom.photographed ? 'text-[#89b994]' : 'text-[#8eb8ca]'
                    }`}
                  >
                    {anom.photographed ? 'Fotoğraflandı' : 'Çekim Bekliyor'}
                  </span>
                </div>

                {!anom.photographed ? (
                  <p className="text-[11px] text-[#9b9282] leading-snug">
                    İpucu: [4] Fotoğraf Makinesi ile <span className="text-[#c6d6de]">{anom.locationHint}</span> noktasını fotoğrafla.
                  </p>
                ) : (
                  <>
                    {anom.photoDataUrl ? (
                      <div className="border border-[#333029] bg-[#090b0e] overflow-hidden">
                        <img
                          src={anom.photoDataUrl}
                          alt={anom.label}
                          className="w-full h-24 object-cover"
                        />
                      </div>
                    ) : (
                      <div className="border border-[#333029] bg-[#0a0c10] px-2.5 py-2 text-[11px] text-[#8d9aa1]">
                        Kayıtlı olay yeri fotoğrafı doğrulandı
                      </div>
                    )}

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#9b9282] mb-1">
                        Kanıt Etiketi
                      </label>
                      <select
                        value={anom.selectedTag}
                        onChange={(e) => onTagAnomaly(caseState.id, anom.id, e.target.value)}
                        className="w-full bg-[#151820] border border-[#3d362b] px-2 py-1.5 text-[11px] text-[#ede5d4] focus:outline-none focus:border-[#8eb8ca]"
                      >
                        <option value="">-- Anomaliyi etiketle --</option>
                        {anom.tagOptions.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="block text-[10px] uppercase tracking-wider text-[#9b9282] mb-1">
                        Otopsi Bulgusuyla Eşleştir
                      </label>
                      <select
                        value={anom.linkedZone}
                        onChange={(e) =>
                          onLinkAnomaly(
                            caseState.id,
                            anom.id,
                            (e.target.value || '') as AutopsyZoneId | '',
                          )
                        }
                        className="w-full bg-[#151820] border border-[#3d362b] px-2 py-1.5 text-[11px] text-[#ede5d4] focus:outline-none focus:border-[#8eb8ca]"
                      >
                        <option value="">-- İlgili anatomik bulguyu seç --</option>
                        {ZONE_ORDER.map((zId) => {
                          const z = caseState.zones[zId];
                          return (
                            <option key={zId} value={zId}>
                              {z.zoneLabel} {z.externalFound ? '✓' : '(İncelenmedi)'}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Forensic Deduction Form */}
        <div className="pt-2 border-t border-[#2c261f] space-y-3">
          <h3 className="text-[11px] uppercase tracking-[0.2em] text-[#c79e59] font-semibold">
            Adli Karar & Zaman Eşleştirme
          </h3>

          <div>
            <label className="block text-[11px] text-[#a79e8d] mb-1">
              Kesin Ölüm Nedeni
            </label>
            <select
              value={caseState.selectedCause}
              onChange={(e) =>
                onUpdateSelection(caseState.id, e.target.value, caseState.selectedTime)
              }
              className="w-full bg-[#151820] border border-[#3d362b] px-2.5 py-2 text-xs text-[#ede5d4] focus:outline-none focus:border-[#c79e59]"
            >
              <option value="">-- Ölüm nedenini seç --</option>
              {diag.causes.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[11px] text-[#a79e8d] mb-1">
              Tahmini Ölüm Zamanı
            </label>
            <select
              value={caseState.selectedTime}
              onChange={(e) =>
                onUpdateSelection(caseState.id, caseState.selectedCause, e.target.value)
              }
              className="w-full bg-[#151820] border border-[#3d362b] px-2.5 py-2 text-xs text-[#ede5d4] focus:outline-none focus:border-[#c79e59]"
            >
              <option value="">-- Ölüm saatini seç --</option>
              {diag.times.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {caseState.diagnosisError && (
            <p className="text-xs text-[#e07970] leading-snug">
              {caseState.diagnosisError}
            </p>
          )}

          <button
            type="button"
            onClick={() => onSubmitDiagnosis(caseState.id)}
            className="w-full py-2.5 bg-[#9e7a43] hover:bg-[#b58e52] text-[#0c0c0e] font-bold text-xs tracking-[0.18em] uppercase cursor-pointer"
          >
            {caseState.completed ? 'Rapor Mühürlendi ✓' : 'Otopsi Raporunu Mühürle'}
          </button>
        </div>
      </div>

      {/* Bottom Live Caption */}
      <div className="relative z-30 flex justify-center">
        {captionText && (
          <div className="px-5 py-2 bg-[#0a0c10]/94 border border-[#544734] text-xs md:text-sm text-[#efe6d4] text-center max-w-xl">
            {captionText}
          </div>
        )}
      </div>
    </div>
  );
};

