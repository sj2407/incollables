import Header from '@/components/ui/Header';
import { DesktopSidebar, MobileBottomNav } from '@/components/ui/Sidebar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-page-gradient">
      <Header />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="flex-1 overflow-y-auto px-5 py-4 pb-20 md:px-6 md:py-6">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
