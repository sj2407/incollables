import Header from '@/components/ui/Header';
import { DesktopSidebar, MobileBottomNav } from '@/components/ui/Sidebar';

export default function StudentLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <div className="flex flex-1">
        <DesktopSidebar />
        <main className="flex-1 overflow-y-auto bg-page-gradient p-4 pb-20 md:p-6 md:pb-6">{children}</main>
      </div>
      <MobileBottomNav />
    </div>
  );
}
