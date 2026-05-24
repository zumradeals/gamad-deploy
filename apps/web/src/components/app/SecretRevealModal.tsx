import { useState } from 'react';
import { Copy, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';

interface SecretRevealModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  description: string;
  secret: string;
  confirmLabel: string;
  closeLabel: string;
  copyLabel: string;
  copiedLabel: string;
}

export function SecretRevealModal({
  open,
  onClose,
  title,
  description,
  secret,
  confirmLabel,
  closeLabel,
  copyLabel,
  copiedLabel,
}: SecretRevealModalProps) {
  const [copied, setCopied] = useState(false);
  const [confirmed, setConfirmed] = useState(false);

  const handleCopy = () => {
    void navigator.clipboard.writeText(secret).then(() => {
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    });
  };

  const handleClose = () => {
    // Reset local state before closing — the parent calls mutation.reset()
    setConfirmed(false);
    setCopied(false);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => { if (!isOpen) handleClose(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        {/* Secret display — never enters any store, lives only in this render */}
        <div className="relative my-2">
          <pre className="overflow-x-auto rounded-lg bg-[#0d1117] px-4 py-3 pr-12 font-mono text-xs text-emerald-400 select-all border border-white/10">
            {secret}
          </pre>
          <button
            onClick={handleCopy}
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1.5 text-gray-400 hover:text-white transition-colors"
            aria-label={copyLabel}
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
          </button>
        </div>
        {copied && (
          <p className="text-xs text-emerald-500 text-center -mt-1">{copiedLabel}</p>
        )}

        {/* Confirmation checkbox — close button gated behind it */}
        <label className="flex items-start gap-3 cursor-pointer mt-2">
          <input
            type="checkbox"
            checked={confirmed}
            onChange={(e) => setConfirmed(e.target.checked)}
            className="mt-0.5 accent-[--accent]"
          />
          <span className="text-sm text-[--text]">{confirmLabel}</span>
        </label>

        <DialogFooter>
          <Button onClick={handleClose} disabled={!confirmed}>
            {closeLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
