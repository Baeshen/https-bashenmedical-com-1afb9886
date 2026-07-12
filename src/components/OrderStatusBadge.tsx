import {
  UNIFIED_STATUS_LABELS_AR,
  UNIFIED_STATUS_STYLES,
  toUnifiedStatus,
  type OrderTableKind,
  type UnifiedStatus,
} from "@/lib/unified-status";

type Props = {
  kind: OrderTableKind;
  /** الحالة الخام من قاعدة البيانات (سيتم تحويلها). أو حالة موحّدة جاهزة. */
  status: string | null | undefined | UnifiedStatus;
  /** إذا كانت `status` موحّدة أصلاً، مرّر true لتجاوز التحويل. */
  raw?: boolean;
  className?: string;
};

/**
 * شارة حالة موحّدة عربية للطلبات (Bashen Medical).
 * تُستخدم عبر كل الواجهات لضمان تسميات وألوان متسقة.
 */
export function OrderStatusBadge({ kind, status, raw = true, className = "" }: Props) {
  const unified: UnifiedStatus = raw
    ? toUnifiedStatus(kind, typeof status === "string" ? status : null)
    : (status as UnifiedStatus);
  const label = UNIFIED_STATUS_LABELS_AR[unified];
  const styles = UNIFIED_STATUS_STYLES[unified];
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium whitespace-nowrap ${styles} ${className}`}
    >
      {label}
    </span>
  );
}
