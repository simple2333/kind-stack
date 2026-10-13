"use client";

import { useEffect, useState } from "react";
import { listCategoriesAction, listPublicCategoriesAction } from "@/lib/actions";

/**
 * 动态加载分类列表（替代硬编码数组）。
 * publicMode=true 时用公开接口（捐赠表单，无需登录）。
 */
export function useCategories(publicMode = false) {
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const fn = publicMode ? listPublicCategoriesAction : listCategoriesAction;
      const res = await fn();
      if (!cancelled) {
        setCategories(res.ok ? res.categories.map((c) => c.name) : []);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [publicMode]);

  return { categories, loading };
}
