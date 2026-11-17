import React, { useEffect, useRef, useState } from 'react';
import { ControlSettings, GameHudState, GraphicsQualityPreset } from '../game/types';

interface GameHudProps {
  hud: GameHudState;
  onToggleNotebook: () => void;
  onToggleCandle: () => void;
  onToggleMute: () => void;
  onPause: () => void;
  onResume: () => void;
  onRestart: () => void;
  onReturnTitle: () => void;
  onUpdateControls: (patch: Partial<ControlSettings>) => void;
  onInteract: () => void;
  onToggleCrouch: () => void;
  onSetVirtualMove: (x: number, y: number) => void;
  onVirtualLook: (dx: number, dy: number) => void;
  onSetSprint: (active: boolean) => void;
}

export const GameHud: React.FC<GameHudProps> = ({
  hud,
  onToggleNotebook,
  onToggleCandle,
  onToggleMute,
  onPause,
  onResume,
  onRestart,
  onReturnTitle,
  onUpdateControls,
  onInteract,
  onToggleCrouch,
  onSetVirtualMove,
  onVirtualLook,
  onSetSprint,
}) => {
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [showControlsInPause, setShowControlsInPause] = useState(false);
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const [padOffset, setPadOffset] = useState({ x: 0, y: 0 });
  const padOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lookTouchRef = useRef<{ id: number; x: number; y: number } | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const coarse = window.matchMedia?.('(pointer: coarse)').matches;
      setIsTouchDevice(Boolean(coarse || ('ontouchstart' in window && navigator.maxTouchPoints > 0)));
    }
  }, []);

  const overlayActive =
    hud.isNotebookOpen || Boolean(hud.activeDialogue) || Boolean(hud.activeAutopsyCaseId);

  const handlePadTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch) return;
    const rect = e.currentTarget.getBoundingClientRect();
    padOriginRef.current = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    updatePadFromPoint(touch.clientX, touch.clientY);
  };

  const handlePadTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    const touch = e.changedTouches[0];
    if (!touch || !padOriginRef.current) return;
    updatePadFromPoint(touch.clientX, touch.clientY);
  };

  const handlePadTouchEnd = () => {
    padOriginRef.current = null;
    setPadOffset({ x: 0, y: 0 });
    onSetVirtualMove(0, 0);
  };

  const updatePadFromPoint = (clientX: number, clientY: number) => {
    if (!padOriginRef.current) return;
    const maxR = 38;
    const dx = clientX - padOriginRef.current.x;
    const dy = clientY - padOriginRef.current.y;
    const dist = Math.hypot(dx, dy) || 1;
    const clamped = Math.min(dist, maxR);
    const nx = (dx / dist) * (clamped / maxR);
    const ny = (dy / dist) * (clamped / maxR);
    setPadOffset({ x: nx * maxR, y: ny * maxR });
    onSetVirtualMove(nx, -ny);
  };

  const handleLookTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (lookTouchRef.current) return;
    const t = e.changedTouches[0];
    if (!t) return;
    lookTouchRef.current = { id: t.identifier, x: t.clientX, y: t.clientY };
  };

  const handleLookTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!lookTouchRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier === lookTouchRef.current.id) {
        const dx = t.clientX - lookTouchRef.current.x;
        const dy = t.clientY - lookTouchRef.current.y;
        lookTouchRef.current.x = t.clientX;
        lookTouchRef.current.y = t.clientY;
        onVirtualLook(dx, dy);
        break;
      }
    }
  };

  const handleLookTouchEnd = (e: React.TouchEvent<HTMLDivElement>) => {
    if (!lookTouchRef.current) return;
    for (let i = 0; i < e.changedTouches.length; i++) {
      if (e.changedTouches[i].identifier === lookTouchRef.current.id) {
        lookTouchRef.current = null;
        break;
      }
    }
  };

  const completedAutopsies = Object.values(hud.autopsyCases).filter((c) => c.completed).length;

  return (
    <>
      {/* Subtle Danger Vignette when Kara Basma or Sis Gözcüsü is close */}
      {hud.screen === 'playing' && hud.dangerProximity > 0.15 && (
        <div
          className="fixed inset-0 z-10 pointer-events-none transition-opacity duration-200"
          style={{
            opacity: Math.min(0.85, hud.dangerProximity * 0.9),
            background:
              'radial-gradient(circle at center, transparent 42%, rgba(8, 5, 6, 0.92) 100%)',
          }}
        />
      )}

      {/* Touch Look Area */}
      {hud.screen === 'playing' && !overlayActive && isTouchDevice && (
        <div
          className="fixed top-0 right-0 bottom-24 left-1/2 z-10 touch-none"
          onTouchStart={handleLookTouchStart}
          onTouchMove={handleLookTouchMove}
          onTouchEnd={handleLookTouchEnd}
          onTouchCancel={handleLookTouchEnd}
        />
      )}

      {/* Low-Occlusion HUD Perimeter Overlay */}
      {hud.screen === 'playing' && !hud.activeAutopsyCaseId && (
        <div className="fixed inset-0 z-20 pointer-events-none flex flex-col justify-between p-5">
          {/* Top Perimeter Row */}
          <div className="flex items-start justify-between gap-4">
            {/* Top-Left: Act & Current Objective */}
            <div className="bg-[#0c0d0f]/90 border border-[#e2d9c8]/15 px-4 py-2.5 max-w-md">
              <div className="font-mono-tech flex items-center gap-2.5 text-[10px] tracking-[0.2em] uppercase text-[#c84b44]">
                <span>{hud.actTitle}</span>
                <span className="text-[#6e6459]">·</span>
                <span className="text-[#9e9585]">{hud.locationName}</span>
              </div>
              <div className="text-sm text-[#e2d9c8] mt-1 font-medium leading-snug">
                {hud.objectiveText}
              </div>
              {(hud.isCrouching || hud.isZooming || hud.stamina < 99) && (
                <div className="font-mono-tech flex items-center gap-3 mt-2 pt-1.5 border-t border-[#e2d9c8]/10 text-[10px] tracking-[0.16em] uppercase">
                  {hud.isCrouching && <span className="text-[#c79e59]">EĞİLDİN [C]</span>}
                  {hud.isZooming && <span className="text-[#8fb3c9]">ODAKLANILDI</span>}
                  {hud.stamina < 99 && (
                    <div className="flex items-center gap-2 ml-auto">
                      <span className="text-[#8e8575]">NEFES</span>
                      <div className="w-20 h-1 bg-[#1b1d22] overflow-hidden">
                        <div className="h-full bg-[#8c1d18]" style={{ width: `${hud.stamina}%` }} />
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Auto-Save Notification */}
            {hud.saveNoticeText && (
              <div className="font-mono-tech bg-[#0c0d0f]/95 border border-[#8c1d18]/60 px-3.5 py-1.5 text-[10px] uppercase tracking-[0.18em] text-[#e2d9c8]">
                {hud.saveNoticeText}
              </div>
            )}

            {/* Top-Right Stats & Pause */}
            <div className="flex items-center gap-2 pointer-events-auto">
              {hud.vigilActive && !hud.isIndoors && (
                <div className="bg-[#0c0d0f]/92 border border-[#6e4c2b] px-3 py-2 text-right">
                  <div className="font-mono-tech text-[10px] tracking-[0.16em] uppercase text-[#c79e59]">
                    SABIR MUMU
                  </div>
                  <div className="font-mono-tech text-sm font-medium tabular-nums text-[#f2dfc0]">
                    {hud.vigilTimer}s
                  </div>
                </div>
              )}

              <div className="bg-[#0c0d0f]/92 border border-[#e2d9c8]/15 px-3 py-2 text-right">
                <div className="font-mono-tech text-[10px] tracking-[0.16em] uppercase text-[#6e6459]">OTOPSİ</div>
                <div className="font-mono-tech text-sm font-medium tabular-nums text-[#8fb3c9]">
                  {completedAutopsies}/3
                </div>
              </div>

              <div className="bg-[#0c0d0f]/92 border border-[#e2d9c8]/15 px-3 py-2 text-right">
                <div className="font-mono-tech text-[10px] tracking-[0.16em] uppercase text-[#6e6459]">KORKU</div>
                <div
                  className={`font-mono-tech text-sm font-medium tabular-nums ${
                    hud.dreadLevel >= 65 ? 'text-[#d9635a]' : 'text-[#e2d9c8]'
                  }`}
                >
                  %{hud.dreadLevel}
                </div>
              </div>

              <div className="bg-[#0c0d0f]/92 border border-[#e2d9c8]/15 px-3 py-2 text-right">
                <div className="font-mono-tech text-[10px] tracking-[0.16em] uppercase text-[#6e6459]">İHLAL</div>
                <div
                  className={`font-mono-tech text-sm font-medium tabular-nums ${
                    hud.violations >= 2 ? 'text-[#d9635a]' : 'text-[#e2d9c8]'
                  }`}
                >
                  {hud.violations}
                </div>
              </div>

              <button
                type="button"
                onClick={() => {
                  setShowControlsInPause(true);
                  onPause();
                }}
                className="font-mono-tech px-3 py-2.5 text-[11px] uppercase tracking-wider bg-[#0c0d0f]/92 border border-[#e2d9c8]/15 text-[#e2d9c8]/85 hover:border-[#8c1d18] cursor-pointer"
              >
                Ayarlar
              </button>

              <button
                type="button"
                onClick={() => {
                  setShowControlsInPause(false);
                  onPause();
                }}
                className="font-mono-tech px-3 py-2.5 text-[11px] uppercase tracking-wider bg-[#0c0d0f]/92 border border-[#e2d9c8]/15 text-[#e2d9c8]/85 hover:border-[#8c1d18] cursor-pointer"
              >
                Duraklat
              </button>
            </div>
          </div>

          {/* Center Reticle & Contextual Interact Prompt */}
          {!overlayActive && (
            <div className="fixed inset-0 flex flex-col items-center justify-center pointer-events-none">
              <div
                className={`rounded-full transition-transform ${
                  hud.interactPrompt
                    ? 'w-2 h-2 bg-[#e7c17a] scale-125'
                    : hud.isZooming
                      ? 'w-1 h-1 bg-[#a8cde0]'
                      : 'w-1.5 h-1.5 bg-[#e8e2d5]/65'
                }`}
              />
              {hud.interactPrompt && (
                <div className="mt-5 px-3.5 py-1.5 bg-[#0b0d11]/92 border border-[#8e6f3d] text-xs md:text-sm tracking-wide text-[#f2e8d5]">
                  {hud.interactPrompt}
                </div>
              )}
              {!hud.isPointerLocked && !isTouchDevice && (
                <div className="mt-3 text-[11px] text-[#9b9384] bg-[#0b0d11]/80 px-2.5 py-1">
                  Bakış için ekrana tıkla veya sürükle · Sağ Tık/V Odaklan
                </div>
              )}
            </div>
          )}

          {/* Touch Controls Overlay */}
          {!overlayActive && isTouchDevice && (
            <div className="fixed inset-x-5 bottom-24 flex items-end justify-between pointer-events-none">
              <div
                className="pointer-events-auto relative w-28 h-28 rounded-full border border-[#574d3d] bg-[#0d0f14]/75 flex items-center justify-center touch-none"
                onTouchStart={handlePadTouchStart}
                onTouchMove={handlePadTouchMove}
                onTouchEnd={handlePadTouchEnd}
                onTouchCancel={handlePadTouchEnd}
              >
                <div
                  className="w-11 h-11 rounded-full border border-[#c79e59] bg-[#2a2318]/90"
                  style={{ transform: `translate(${padOffset.x}px, ${padOffset.y}px)` }}
                />
              </div>

              <div className="pointer-events-auto flex flex-col items-end gap-2">
                {hud.interactPrompt && (
                  <button
                    type="button"
                    onClick={onInteract}
                    className="px-4 py-2.5 bg-[#9e7a43] text-[#0c0c0e] font-semibold text-xs uppercase tracking-wider"
                  >
                    Etkileşim
                  </button>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onTouchStart={() => onSetSprint(true)}
                    onTouchEnd={() => onSetSprint(false)}
                    onTouchCancel={() => onSetSprint(false)}
                    className="px-3.5 py-2 border border-[#4a4134] bg-[#0d0f14]/88 text-xs uppercase text-[#dfd6c5]"
                  >
                    Koş
                  </button>
                  <button
                    type="button"
                    onClick={onToggleCrouch}
                    className={`px-3.5 py-2 border text-xs uppercase ${
                      hud.isCrouching
                        ? 'border-[#c79e59] bg-[#362815] text-[#f7e3bd]'
                        : 'border-[#4a4134] bg-[#0d0f14]/88 text-[#dfd6c5]'
                    }`}
                  >
                    Eğil
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Story Caption & Collapsible Bottom Dock */}
          {!hud.activeDialogue && (
            <div className="flex flex-col items-center gap-3 mb-1">
              {hud.captionText && (
                <div className="px-5 py-2.5 bg-[#0a0c10]/94 border border-[#544734] text-sm text-[#efe6d4] text-center max-w-xl">
                  {hud.captionText}
                </div>
              )}

              <div className="pointer-events-auto flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => setDockCollapsed((v) => !v)}
                  className="px-3 py-0.5 text-[10px] tracking-[0.18em] uppercase bg-[#12151b]/95 border border-b-0 border-[#3b352b] text-[#a79e8d] hover:text-[#efe6d4] cursor-pointer"
                >
                  {dockCollapsed ? '▴ Araçları Göster' : '▾ Gizle'}
                </button>

                {!dockCollapsed && (
                  <div className="flex flex-wrap items-center justify-center gap-2 px-4 py-2 bg-[#0d0f14]/94 border border-[#3b352b]">
                    <div className="flex flex-wrap items-center gap-1 pr-3 border-r border-[#2d2922]">
                      {hud.inventory.map((item) => (
                        <span
                          key={item.id}
                          title={item.name}
                          className={`px-2 py-1 text-[11px] border ${
                            item.collected
                              ? 'border-[#8e6f3d] bg-[#2a2216] text-[#f0e2c6]'
                              : 'border-[#2b2924] bg-[#13151a] text-[#6a6459]'
                          }`}
                        >
                          {item.name.split(' ')[0]}
                        </span>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={onToggleCandle}
                      className={`px-2.5 py-1 text-xs border cursor-pointer ${
                        hud.candleLit
                          ? 'border-[#c79e59] bg-[#362815] text-[#f7e3bd]'
                          : 'border-[#3a342a] bg-[#15181e] text-[#b4ab9a]'
                      }`}
                    >
                      Mum [F]: {hud.candleLit ? 'Yanıyor' : 'Sönük'}
                    </button>

                    <button
                      type="button"
                      onClick={onToggleCrouch}
                      className={`px-2.5 py-1 text-xs border cursor-pointer ${
                        hud.isCrouching
                          ? 'border-[#c79e59] bg-[#362815] text-[#f7e3bd]'
                          : 'border-[#3a342a] bg-[#15181e] text-[#b4ab9a]'
                      }`}
                    >
                      Eğil [C]
                    </button>

                    <button
                      type="button"
                      onClick={onToggleNotebook}
                      className="px-2.5 py-1 text-xs border border-[#3a342a] bg-[#15181e] text-[#dfd6c5] hover:border-[#b58d4d] cursor-pointer"
                    >
                      Defter & Harita [Tab]
                    </button>

                    <button
                      type="button"
                      onClick={onToggleMute}
                      className="px-2.5 py-1 text-xs border border-[#3a342a] bg-[#15181e] text-[#b4ab9a] hover:text-[#dfd6c5] cursor-pointer"
                    >
                      {hud.isMuted ? 'Ses Kapalı [M]' : 'Ses Açık [M]'}
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Pause & Control Settings Modal */}
      {hud.screen === 'paused' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07080a]/90 p-6">
          <div className="w-full max-w-md bg-[#0c0d0f] border border-[#e2d9c8]/20 p-7">
            <div className="text-center">
              <h2 className="font-display text-3xl font-bold tracking-[0.12em] text-white mb-1.5">
                {showControlsInPause ? 'KONTROL AYARLARI' : 'DURAKLATILDI'}
              </h2>
              <p className="font-mono-tech text-[11px] uppercase tracking-[0.14em] text-[#8c8174] mb-5">
                {hud.actTitle} · İhlal: <span className="tabular-nums">{hud.violations}</span>
              </p>
            </div>

            <div className="font-mono-tech flex border-b border-[#e2d9c8]/15 mb-5 text-[11px] uppercase tracking-wider">
              <button
                type="button"
                onClick={() => setShowControlsInPause(false)}
                className={`flex-1 py-2 cursor-pointer border-b-2 ${
                  !showControlsInPause
                    ? 'border-[#8c1d18] text-white'
                    : 'border-transparent text-[#6e6459]'
                }`}
              >
                Oyun
              </button>
              <button
                type="button"
                onClick={() => setShowControlsInPause(true)}
                className={`flex-1 py-2 cursor-pointer border-b-2 ${
                  showControlsInPause
                    ? 'border-[#8c1d18] text-white'
                    : 'border-transparent text-[#6e6459]'
                }`}
              >
                Kontroller &amp; Performans
              </button>
            </div>

            {!showControlsInPause ? (
              <div className="font-mono-tech flex flex-col gap-2.5">
                <button
                  type="button"
                  onClick={onResume}
                  className="py-3 bg-[#8c1d18] hover:bg-[#a6231d] text-white font-medium text-xs tracking-[0.18em] uppercase cursor-pointer"
                >
                  DEVAM ET [ESC]
                </button>
                <button
                  type="button"
                  onClick={onRestart}
                  className="py-3 border border-[#e2d9c8]/25 text-[#e2d9c8] hover:border-[#8c1d18] text-xs tracking-[0.16em] uppercase cursor-pointer"
                >
                  YENİDEN BAŞLA
                </button>
                <button
                  type="button"
                  onClick={onReturnTitle}
                  className="py-3 border border-[#e2d9c8]/12 text-[#8c8174] hover:text-[#e2d9c8] text-xs tracking-[0.16em] uppercase cursor-pointer"
                >
                  ANA EKRAN
                </button>
              </div>
            ) : (
              <div className="space-y-4 text-xs text-[#d6cebe]">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <span>Fare Hassasiyeti</span>
                    <span className="tabular-nums text-[#c79e59]">
                      {hud.controlSettings.mouseSensitivity.toFixed(1)}x
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0.4}
                    max={2.4}
                    step={0.1}
                    value={hud.controlSettings.mouseSensitivity}
                    onChange={(e) =>
                      onUpdateControls({ mouseSensitivity: parseFloat(e.target.value) })
                    }
                    className="w-full accent-[#c79e59] cursor-pointer"
                  />
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#25221c]">
                  <span>Bakış Yumuşatma</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateControls({ lookSmoothing: !hud.controlSettings.lookSmoothing })
                    }
                    className={`px-3 py-1 border cursor-pointer ${
                      hud.controlSettings.lookSmoothing
                        ? 'border-[#c79e59] bg-[#2c2214] text-[#f2dfc0]'
                        : 'border-[#3a342a] bg-[#16181f] text-[#9e9585]'
                    }`}
                  >
                    {hud.controlSettings.lookSmoothing ? 'Açık' : 'Kapalı'}
                  </button>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#25221c]">
                  <span>Y Ekseni Ters Çevir</span>
                  <button
                    type="button"
                    onClick={() => onUpdateControls({ invertY: !hud.controlSettings.invertY })}
                    className={`px-3 py-1 border cursor-pointer ${
                      hud.controlSettings.invertY
                        ? 'border-[#c79e59] bg-[#2c2214] text-[#f2dfc0]'
                        : 'border-[#3a342a] bg-[#16181f] text-[#9e9585]'
                    }`}
                  >
                    {hud.controlSettings.invertY ? 'Ters' : 'Normal'}
                  </button>
                </div>

                <div className="flex items-center justify-between py-1 border-t border-[#25221c]">
                  <span>Eğilme Modu [C]</span>
                  <button
                    type="button"
                    onClick={() =>
                      onUpdateControls({ crouchToggle: !hud.controlSettings.crouchToggle })
                    }
                    className={`px-3 py-1 border cursor-pointer ${
                      hud.controlSettings.crouchToggle
                        ? 'border-[#c79e59] bg-[#2c2214] text-[#f2dfc0]'
                        : 'border-[#3a342a] bg-[#16181f] text-[#9e9585]'
                    }`}
                  >
                    {hud.controlSettings.crouchToggle ? 'Aç / Kapat' : 'Basılı Tut'}
                  </button>
                </div>

                <div className="border-t border-[#25221c] pt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span>Grafik Kalitesi (FPS)</span>
                    <span className="text-[11px] text-[#9e9585]">
                      Etkin:{' '}
                      <span className="text-[#c79e59]">
                        {hud.resolvedQualityTier === 'high'
                          ? 'Yüksek'
                          : hud.resolvedQualityTier === 'medium'
                            ? 'Dengeli'
                            : 'Performans'}
                      </span>
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {(
                      [
                        { id: 'auto', label: 'Otomatik' },
                        { id: 'high', label: 'Yüksek' },
                        { id: 'medium', label: 'Dengeli' },
                        { id: 'low', label: 'Performans' },
                      ] as Array<{ id: GraphicsQualityPreset; label: string }>
                    ).map((q) => {
                      const active = hud.controlSettings.graphicsQuality === q.id;
                      return (
                        <button
                          key={q.id}
                          type="button"
                          onClick={() => onUpdateControls({ graphicsQuality: q.id })}
                          className={`py-1.5 text-[11px] border cursor-pointer ${
                            active
                              ? 'border-[#c79e59] bg-[#2c2214] text-[#f2dfc0]'
                              : 'border-[#3a342a] bg-[#16181f] text-[#9e9585] hover:border-[#6e604a]'
                          }`}
                        >
                          {q.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="border-t border-[#25221c] pt-3 text-[11px] text-[#9e9585] grid grid-cols-2 gap-y-1">
                  <span>WASD / Oklar: Hareket</span>
                  <span>Shift: Hızlı Koşu</span>
                  <span>E / Sol Tık: Etkileşim</span>
                  <span>Sağ Tık / V: Odaklan</span>
                  <span>C / Ctrl: Eğil</span>
                  <span>F: Mum · Tab: Defter</span>
                </div>

                <button
                  type="button"
                  onClick={onResume}
                  className="font-mono-tech w-full py-3 mt-2 bg-[#8c1d18] hover:bg-[#a6231d] text-white font-medium text-xs tracking-[0.18em] uppercase cursor-pointer"
                >
                  OYUNA DÖN [ESC]
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Endings & Game Over Modals */}
      {(hud.screen === 'ending_peace' ||
        hud.screen === 'ending_truth' ||
        hud.screen === 'ending_twist' ||
        hud.screen === 'game_over') && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#07080a]/94 p-6">
          <div className="w-full max-w-lg bg-[#0c0d0f] border border-[#e2d9c8]/20 p-8 md:p-10 text-center">
            <div className="font-mono-tech text-[11px] tracking-[0.26em] uppercase text-[#b8322c] mb-2">
              {hud.screen === 'ending_truth'
                ? 'GERÇEK SON · HAKİKAT VE ŞAFAK'
                : hud.screen === 'ending_peace'
                  ? 'DOĞRU SON · SABAH EZANI'
                  : hud.screen === 'ending_twist'
                    ? 'KARANLIK SON · KİMİN CENAZESİ?'
                    : 'GECEYE YENİLDİN'}
            </div>
            <h2 className="font-display text-4xl font-bold text-white tracking-wide mb-4">
              {hud.screen === 'ending_truth'
                ? 'Adalet ve Son Vazife'
                : hud.screen === 'ending_peace'
                  ? 'Son Vazife Tamamlandı'
                  : hud.screen === 'ending_twist'
                    ? 'Giden Senmişsin'
                    : 'Kara Basma Çöktü'}
            </h2>
            <p className="text-sm leading-relaxed text-[#e2d9c8]/80 mb-6">{hud.endingReason}</p>

            <div className="grid grid-cols-4 gap-3 border-y border-[#e2d9c8]/12 py-4 mb-7 text-xs">
              <div>
                <div className="font-mono-tech text-[10px] text-[#6e6459] uppercase">Otopsi</div>
                <div className="font-display text-2xl font-bold tabular-nums text-[#e2d9c8] mt-0.5">
                  {completedAutopsies}/3
                </div>
              </div>
              <div>
                <div className="font-mono-tech text-[10px] text-[#6e6459] uppercase">İhlaller</div>
                <div className="font-display text-2xl font-bold tabular-nums text-[#e2d9c8] mt-0.5">
                  {hud.violations}
                </div>
              </div>
              <div>
                <div className="font-mono-tech text-[10px] text-[#6e6459] uppercase">Ritüel</div>
                <div className="font-display text-2xl font-bold tabular-nums text-[#e2d9c8] mt-0.5">
                  {hud.ritualProgress}/8
                </div>
              </div>
              <div>
                <div className="font-mono-tech text-[10px] text-[#6e6459] uppercase">Belgeler</div>
                <div className="font-display text-2xl font-bold tabular-nums text-[#e2d9c8] mt-0.5">
                  {hud.clues.filter((c) => c.discovered).length}/{hud.clues.length}
                </div>
              </div>
            </div>

            <div className="font-mono-tech flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={onRestart}
                className="px-6 py-3.5 bg-[#8c1d18] hover:bg-[#a6231d] text-white font-medium text-xs tracking-[0.18em] uppercase cursor-pointer"
              >
                TEKRAR OYNA
              </button>
              <button
                type="button"
                onClick={onReturnTitle}
                className="px-6 py-3.5 border border-[#e2d9c8]/25 text-[#e2d9c8] hover:border-[#8c1d18] text-xs tracking-[0.18em] uppercase cursor-pointer"
              >
                ANA EKRAN
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
