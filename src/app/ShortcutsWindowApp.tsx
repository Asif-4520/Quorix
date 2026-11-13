import { Keyboard } from 'lucide-react';
import type React from 'react';
import { ShortcutsModal } from '../features/shortcuts/ShortcutsModal';
import { StudioWindowFrame } from './StudioWindowFrame';

export const ShortcutsWindowApp: React.FC = () => (
  <StudioWindowFrame
    windowTitle="Keyboard Shortcuts — Quorix"
    headerTitle="Keyboard Shortcuts"
    studioBadge="Keymap Studio"
    icon={<Keyboard size={12} className="text-[var(--accent)]" />}
  >
    {({ onClose, onRequestConfirm }) => (
      <ShortcutsModal
        isOpen={true}
        standaloneWindow={true}
        onClose={onClose}
        onRequestConfirm={onRequestConfirm}
      />
    )}
  </StudioWindowFrame>
);
