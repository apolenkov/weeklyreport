import { redirect } from 'next/navigation';

/**
 * `/admin/products` — thin alias that forwards to the canonical
 * `/admin?tab=products` route. The admin panel is a single page with
 * tab-based content (see ../page.tsx); this route exists so that direct
 * URLs and integration-test navigations stay readable, while the rendering
 * logic remains centralized in the AdminPanel component.
 */
export default function AdminProductsPage(): never {
  redirect('/admin?tab=products');
}
