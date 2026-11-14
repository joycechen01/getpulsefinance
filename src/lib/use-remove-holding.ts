import { useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";

import { addHolding, removeHolding, type PortfolioRow } from "@/lib/portfolio.functions";

/** Removes a holding right away and offers Undo, which re-adds it with its saved position. */
export function useRemoveHolding() {
  const qc = useQueryClient();
  const remove = useServerFn(removeHolding);
  const add = useServerFn(addHolding);

  return async (h: Pick<PortfolioRow, "id" | "ticker" | "shares" | "avgPrice">) => {
    try {
      await remove({ data: { id: h.id } });
    } catch {
      toast.error(`Couldn’t remove ${h.ticker}`);
      return;
    }
    await qc.invalidateQueries({ queryKey: ["portfolio"] });
    toast(`${h.ticker} removed`, {
      action: {
        label: "Undo",
        onClick: async () => {
          const r = await add({ data: { ticker: h.ticker, shares: h.shares, avgPrice: h.avgPrice } }).catch(() => null);
          if (!r?.ok) toast.error(`Couldn’t restore ${h.ticker}`);
          await qc.invalidateQueries({ queryKey: ["portfolio"] });
        },
      },
    });
  };
}
