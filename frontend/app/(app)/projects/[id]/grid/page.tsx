"use client";

import { use, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";

/**
 * Legacy grid route → the merged deal room. The engagement grid now lives inline at
 * /projects/[id]?book=N; this keeps old bookmarks and deep links working.
 */
export default function GridRedirect({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const sp = useSearchParams();

  useEffect(() => {
    const mandate = sp.get("mandate_id");
    router.replace(`/projects/${id}${mandate ? `?book=${mandate}` : ""}`);
  }, [id, router, sp]);

  return null;
}
