import { useState, useEffect } from 'react';
import { Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface DangerConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  // The text the user must type exactly (case-insensitive)
  targetName: string;
  // Display prompt, e.g. "Tapez « monorg » pour confirmer"
  confirmPrompt: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  isLoading?: boolean;
}

export function DangerConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  targetName,
  confirmPrompt,
  confirmLabel,
  cancelLabel,
  onConfirm,
  isLoading = false,
}: DangerConfirmDialogProps) {
  const [input, setInput] = useState('');
  // 500 ms delay prevents accidental double-click from parent "Delete" button
  const [canConfirm, setCanConfirm] = useState(false);

  useEffect(() => {
    if (!open) return;
    setInput('');
    setCanConfirm(false);
    const timer = window.setTimeout(() => setCanConfirm(true), 500);
    return () => window.clearTimeout(timer);
  }, [open]);

  const matches = input.trim().toLowerCase() === targetName.toLowerCase();
  const isEnabled = matches && canConfirm && !isLoading;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3 my-2">
          <p className="text-sm text-[--text]">{confirmPrompt}</p>
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            autoComplete="off"
            autoFocus
          />
          {/* No error message while typing — button state is the feedback */}
        </div>

        <DialogFooter>
          <DialogClose asChild>
            <Button type="button" variant="outline">{cancelLabel}</Button>
          </DialogClose>
          <Button
            variant="destructive"
            disabled={!isEnabled}
            onClick={onConfirm}
            className="gap-2"
          >
            {isLoading && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
