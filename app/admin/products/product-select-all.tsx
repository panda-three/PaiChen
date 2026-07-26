"use client";

export function ProductSelectAll({ count }: { count: number }) {
  return <label className="inline-flex items-center gap-2 whitespace-nowrap text-sm font-medium">
    <input
      type="checkbox"
      disabled={!count}
      aria-label="全选当前结果"
      onChange={(event) => document.querySelectorAll<HTMLInputElement>("[data-product-selection]").forEach((input) => { input.checked = event.currentTarget.checked; })}
    />
    全选当前结果（{count}）
  </label>;
}
