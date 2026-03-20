import Header from '@/components/ui/Header';
import { DesktopSidebar, MobileBottomNav } from '@/components/ui/Sidebar';
import { requireAdmin } from '@/lib/admin';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <div className="flex min-h-screen flex-col bg-page-gradient">
      <Header />
      <div className="flex flex-1">
        <DesktopSidebar isAdmin />
        <main className="flex-1 overflow-y-auto px-5 py-4 pb-20 md:px-6 md:py-6">{children}</main>
      </div>
      <MobileBottomNav isAdmin />
    </div>
  );
}
