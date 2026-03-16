import Header from '@/components/ui/Header';
import { DesktopSidebar, MobileBottomNav } from '@/components/ui/Sidebar';
import { requireAdmin } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <DesktopSidebar isAdmin />
        <main className="flex-1 overflow-y-auto p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileBottomNav isAdmin />
    </div>
  );
}
