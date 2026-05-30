import { useEffect, useState } from 'react';
import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '@/lib/db';
import { Home, Database, Truck, FileText, Banknote, Settings, CreditCard, User, LineChart, ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Toaster } from 'sonner';
import { Button } from '@/components/ui/button';

const navItems = [
  { icon: Home, label: 'Dashboard', path: '/app' },
  { icon: Database, label: 'Master Data', path: '/app/master' },
  { icon: Truck, label: 'Trip', path: '/app/trips' },
  { icon: FileText, label: 'Invoice', path: '/app/invoices' },
  { icon: CreditCard, label: 'Slip Bayar', path: '/app/slips' },
  { icon: LineChart, label: 'Laba Rugi', path: '/app/margin' },
  { icon: Banknote, label: 'Keuangan', path: '/app/finance' },
  { icon: Settings, label: 'Pengaturan', path: '/app/settings' },
];

export default function AppLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const settingsArray = useLiveQuery(() => db.storeSettings.toArray());
  const settings = settingsArray?.[0];

  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    return localStorage.getItem('sidebarCollapsed') === 'true';
  });

  const toggleSidebar = () => {
    setIsSidebarCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebarCollapsed', String(next));
      return next;
    });
  };

  useEffect(() => {
    // Only redirect if settings array is loaded, and it's not the onboarding page
    if (settingsArray !== undefined && location.pathname !== '/app/onboarding') {
      if (!settings?.userName) {
        navigate('/app/onboarding');
      }
    }
  }, [settings, settingsArray, location.pathname, navigate]);

  // If we're on the onboarding page, render just the Outlet (no sidebar)
  if (location.pathname === '/app/onboarding') {
    return <Outlet />;
  }

  // Show loading state while checking DB to prevent flashing
  if (settingsArray === undefined) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-4">
        <div className="animate-spin rounded-full h-10 w-10 border-b-4 border-primary"></div>
        <p className="text-muted-foreground animate-pulse">Memuat data...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar (Desktop) */}
      <aside className={cn(
        "border-r bg-card hidden md:flex flex-col print:hidden transition-all duration-300",
        isSidebarCollapsed ? "w-20" : "w-64"
      )}>
        <div className={cn("p-6 flex items-center h-20", isSidebarCollapsed ? "justify-center" : "justify-between")}>
          {!isSidebarCollapsed ? (
            <h1 className="text-2xl font-bold text-primary">LogistikPro</h1>
          ) : (
            <h1 className="text-2xl font-bold text-primary">LP</h1>
          )}
        </div>
        
        <nav className={cn("flex-1 space-y-2", isSidebarCollapsed ? "px-2" : "px-4")}>
          {navItems.map(item => (
            <Link
              key={item.path}
              to={item.path}
              title={isSidebarCollapsed ? item.label : undefined}
              className={cn(
                "flex items-center gap-3 rounded-lg text-sm font-medium transition-colors",
                isSidebarCollapsed ? "justify-center py-3 px-0" : "px-4 py-3",
                location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/app')
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-muted"
              )}
            >
              <item.icon className="w-5 h-5 shrink-0" />
              {!isSidebarCollapsed && <span>{item.label}</span>}
            </Link>
          ))}
        </nav>

        {/* Toggle Button */}
        <div className="px-4 py-2 flex justify-center">
           <Button variant="ghost" size="icon" onClick={toggleSidebar} className="text-muted-foreground hover:text-primary">
             {isSidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
           </Button>
        </div>

        {/* User Profile Snippet in Sidebar */}
        <div className="p-4 border-t">
          <Link to="/app/settings" className={cn("flex items-center gap-3 hover:bg-muted rounded-lg transition", isSidebarCollapsed ? "p-1 justify-center" : "p-2")}>
            <div className="w-10 h-10 rounded-full bg-muted border flex items-center justify-center overflow-hidden shrink-0">
              {settings?.userAvatar ? (
                <img src={settings.userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-5 h-5 text-muted-foreground" />
              )}
            </div>
            {!isSidebarCollapsed && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{settings?.userName || 'User'}</p>
                <p className="text-xs text-muted-foreground truncate">{settings?.companyName || 'LogistikPro'}</p>
              </div>
            )}
          </Link>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden relative print:h-auto print:overflow-visible">
        {/* Top Header Mobile (Profile) */}
        <div className="md:hidden print:hidden border-b bg-card p-3 flex items-center justify-between shrink-0">
          <h1 className="text-lg font-bold text-primary truncate">{settings?.companyName || 'LogistikPro'}</h1>
          <Link to="/app/settings">
            <div className="w-8 h-8 rounded-full bg-muted border flex items-center justify-center overflow-hidden">
              {settings?.userAvatar ? (
                <img src={settings.userAvatar} alt="Profile" className="w-full h-full object-cover" />
              ) : (
                <User className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto pb-20 md:pb-0 print:overflow-visible">
          <Outlet />
        </div>
      </main>

      {/* Bottom Nav (Mobile) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card flex overflow-x-auto no-scrollbar p-2 pb-safe print:hidden">
        {navItems.filter(item => item.path !== '/app/settings').map(item => (
          <Link
            key={item.path}
            to={item.path}
            className={cn(
              "flex flex-col items-center justify-center p-2 rounded-lg min-w-[72px] flex-shrink-0",
              location.pathname === item.path || (location.pathname.startsWith(item.path) && item.path !== '/app')
                ? "text-primary"
                : "text-muted-foreground"
            )}
          >
            <item.icon className="w-5 h-5 mb-1" />
            <span className="text-[10px] font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>
      <Toaster />
    </div>
  );
}
