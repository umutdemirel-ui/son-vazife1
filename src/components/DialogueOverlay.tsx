import React from 'react';
import { ActiveDialogueState } from '../game/types';

interface DialogueOverlayProps {
  dialogue: ActiveDialogueState;
  onSelectOption: (optionId: string) => void;
  onClose: () => void;
}

export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({
  dialogue,
  onSelectOption,
  onClose,
}) => {
  return (
    <div className="fixed inset-x-0 bottom-5 z-30 flex justify-center px-4 pointer-events-none">
      <div className="pointer-events-auto w-full max-w-2xl bg-[#0c0d0f]/96 border border-[#e2d9c8]/20 shadow-2xl p-5 md:p-6">
        <div className="flex items-start justify-between gap-4 border-b border-[#e2d9c8]/12 pb-3 mb-3.5">
          <div>
            <div className="font-mono-tech text-[10px] uppercase tracking-[0.22em] text-[#b8322c] font-medium">
              {dialogue.speakerRole}
            </div>
            <h3 className="font-display text-2xl md:text-3xl font-bold text-white tracking-wide mt-0.5">
              {dialogue.speakerName}
            </h3>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="font-mono-tech text-[10px] uppercase tracking-[0.16em] text-[#6e6459]">
                Güven
              </div>
              <div className="font-mono-tech text-xs font-medium tabular-nums text-[#e2d9c8]">
                %{dialogue.trustLevel}
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="font-mono-tech px-3 py-1.5 text-[10px] uppercase tracking-wider border border-[#e2d9c8]/20 bg-[#0c0d0f] text-[#b8af9e] hover:border-[#8c1d18] hover:text-white cursor-pointer"
            >
              Ayrıl [Esc]
            </button>
          </div>
        </div>

        <p className="text-sm md:text-base leading-relaxed text-[#e6decb] mb-4">
          “{dialogue.text}”
        </p>

        <div className="flex flex-col gap-2">
          {dialogue.options.map((opt) => {
            const isEvidenceChoice = Boolean(opt.requiredClueId || opt.requiredCompletedCase);
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onSelectOption(opt.id)}
                className={`text-left px-3.5 py-2.5 text-xs md:text-sm border transition-colors cursor-pointer ${
                  isEvidenceChoice
                    ? 'border-[#9e7a43] bg-[#241d13] text-[#f5e3be] hover:bg-[#332818]'
                    : 'border-[#332e26] bg-[#13161c] text-[#d6cebd] hover:border-[#8c7143] hover:text-[#f5ebd6]'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
