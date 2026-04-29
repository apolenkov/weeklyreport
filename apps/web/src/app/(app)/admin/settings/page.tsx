import { redirect } from 'next/navigation';

/**
 * `/admin/settings` — thin alias that forwards to `/admin?tab=settings`.
 * Mirrors `/admin/products`; see the sibling file for rationale.
 */
export default function AdminSettingsPage(): never {
  redirect('/admin?tab=settings');
}
