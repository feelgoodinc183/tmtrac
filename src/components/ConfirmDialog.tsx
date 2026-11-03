import React, { useRef } from 'react';
import { Dialog } from './ui/Dialog';
import { Button } from './ui/Button';

interface ConfirmDialogProps {
  title: string;
  body: React.ReactNode;
  confirmLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation step for actions that change race results. Focus starts on Cancel so a
 * stray Enter or tap on deck does nothing; Esc cancels.
 */
export const ConfirmDialog: React.FC<ConfirmDialogProps> = ({ title, body, confirmLabel, onConfirm, onCancel }) => {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog
      open
      role="alertdialog"
      title={title}
      description={body}
      onClose={onCancel}
      initialFocusRef={cancelRef}
      footer={
        <>
          <Button ref={cancelRef} size="lg" onClick={onCancel}>
            Cancel
          </Button>
          <Button variant="danger" size="lg" onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </>
      }
    />
  );
};
