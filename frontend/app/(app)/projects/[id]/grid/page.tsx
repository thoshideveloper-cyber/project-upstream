"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy routes into the project, kept alive.
 *
 * `/projects/[id]/grid` was the standalone engagement grid before the deal room merged
 * it inline; the grid then lived at `/projects/[id]?book=N`, and now the whole book lives
 * at `/projects/[id]/workspace`. Two generations of bookmarks and one generation of
 * in-product links point at this path, so it forwards rather than 404s — carrying the
 * engagement across under its current name.
 */
export default function GridRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const mandate = sp.get("mandate_id") ?? sp.get("book");
    router.replace(`/projects/${id}/workspace${mandate ? `?book=${mandate}` : ""}`);
  }, [id, router, sp]);

  return null;
}
