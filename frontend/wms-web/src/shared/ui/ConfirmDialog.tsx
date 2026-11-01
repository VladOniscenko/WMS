import { useEffect, useRef, useState, useCallback } from "react";
import { AlertTriangle } from "lucide-react";

export interface ConfirmDialogProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
  isLoading?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmDialog({
  isOpen,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  isDestructive = true,
  isLoading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (isOpen) {
      if (!dialog.open) {
        dialog.showModal();
      }
    } else {
      if (dialog.open) {
        dialog.close();
      }
    }
  }, [isOpen]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    const handleCancel = (e: Event) => {
      e.preventDefault();
      onCancel();
    };

    dialog.addEventListener("cancel", handleCancel);
    return () => dialog.removeEventListener("cancel", handleCancel);
  }, [onCancel]);

  if (!isOpen) return null;

  return (
    <dialog
      ref={dialogRef}
      className="fixed inset-0 m-auto p-0 rounded-2xl shadow-2xl bg-white border border-stone-200 max-w-md w-full backdrop:bg-black/45 backdrop:backdrop-blur-xs open:animate-in open:fade-in open:zoom-in-95 z-50 text-stone-900"
      aria-labelledby="confirm-dialog-title"
      aria-describedby="confirm-dialog-desc"
      onClick={(e) => {
        // Close if click outside dialog content (on backdrop)
        const rect = dialogRef.current?.getBoundingClientRect();
        if (
          rect &&
          (e.clientX < rect.left ||
            e.clientX > rect.right ||
            e.clientY < rect.top ||
            e.clientY > rect.bottom)
        ) {
          onCancel();
        }
      }}
    >
      <div className="p-6">
        <div className="flex items-start gap-4">
          {isDestructive && (
            <div className="p-2.5 rounded-full bg-rose-100 text-rose-600 flex-shrink-0">
              <AlertTriangle className="w-5 h-5" />
            </div>
          )}
          <div className="flex-1">
            <h3
              id="confirm-dialog-title"
              className="text-lg font-semibold text-stone-900"
            >
              {title}
            </h3>
            <p
              id="confirm-dialog-desc"
              className="mt-2 text-sm text-stone-600 leading-relaxed"
            >
              {description}
            </p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            disabled={isLoading}
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium rounded-lg border border-stone-300 text-stone-700 bg-white hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-stone-400 disabled:opacity-50 transition-colors"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={isLoading}
            onClick={() => void onConfirm()}
            className={`px-4 py-2 text-sm font-semibold rounded-lg text-white focus:outline-none focus:ring-2 disabled:opacity-50 transition-colors ${
              isDestructive
                ? "bg-rose-600 hover:bg-rose-700 focus:ring-rose-500"
                : "bg-stone-900 hover:bg-stone-800 focus:ring-stone-700"
            }`}
          >
            {isLoading ? "Processing…" : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}

// Hook for imperative confirm usage
interface ConfirmOptions {
  title: string;
  description: string;
  confirmLabel?: string;
  cancelLabel?: string;
  isDestructive?: boolean;
}

export function useConfirm() {
  const [state, setState] = useState<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { title: "", description: "" },
  });

  const confirm = useCallback((options: ConfirmOptions): Promise<boolean> => {
    return new Promise((resolve) => {
      setState({
        isOpen: true,
        options,
        resolve,
      });
    });
  }, []);

  const handleConfirm = useCallback(() => {
    state.resolve?.(true);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state]);

  const handleCancel = useCallback(() => {
    state.resolve?.(false);
    setState((prev) => ({ ...prev, isOpen: false }));
  }, [state]);

  const ConfirmDialogComponent = (
    <ConfirmDialog
      isOpen={state.isOpen}
      title={state.options.title}
      description={state.options.description}
      confirmLabel={state.options.confirmLabel}
      cancelLabel={state.options.cancelLabel}
      isDestructive={state.options.isDestructive ?? true}
      onConfirm={handleConfirm}
      onCancel={handleCancel}
    />
  );

  return {
    confirm,
    ConfirmDialogComponent,
  };
}
