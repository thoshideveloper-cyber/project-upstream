import { toast } from "sonner";

/**
 * Success toast that offers to reverse what just happened.
 *
 * Every destructive action in Upstream is a soft delete (CLAUDE.md rule 6), so
 * the reversal already exists as an API call — the only thing missing was a way
 * to reach it without hunting for the archived record. Pairs with `useConfirm`:
 * confirm before, undo after.
 */
export function toastUndo(
  message: string,
  undo: () => Promise<unknown> | unknown,
  options: {
    /** Optional second line, e.g. how many rows were affected. */
    description?: string;
    /** What to say once the reversal lands. */
    undoneMessage?: string;
    /** Longer than the default toast, so Undo is genuinely reachable. */
    duration?: number;
  } = {},
) {
  const { description, undoneMessage = "Restored", duration = 8000 } = options;

  toast.success(message, {
    description,
    duration,
    action: {
      label: "Undo",
      onClick: async () => {
        try {
          await undo();
          toast.success(undoneMessage);
        } catch {
          toast.error("Couldn't undo that");
        }
      },
    },
  });
}
