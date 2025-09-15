import React from 'react';
import { Button } from '@/components/ui/button';
import { Home, Clock, Settings, Download } from 'lucide-react';
import { useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { ExportModal } from './ExportModal';

export function BottomNav() {
  const location = useLocation();

  const navItems = [
    { icon: Home, label: 'Home', href: '/', active: location.pathname === '/' },
    { icon: Clock, label: 'Timeline', href: '/timeline', active: location.pathname === '/timeline' },
    { icon: Settings, label: 'Settings', href: '/settings', active: location.pathname === '/settings' },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-card/95 backdrop-blur-sm border-t shadow-strong">
      <div className="max-w-md mx-auto px-4 py-2">
        <div className="flex items-center justify-around">
          {navItems.map((item) => (
            <Button
              key={item.href}
              variant="ghost"
              size="sm"
              asChild
              className={cn(
                "flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-xl transition-all duration-200",
                item.active 
                  ? "bg-primary/10 text-primary" 
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/50"
              )}
            >
              <a href={item.href}>
                <item.icon className={cn("h-5 w-5", item.active && "text-primary")} />
                <span className="text-xs font-medium">{item.label}</span>
              </a>
            </Button>
          ))}
          
          <ExportModal>
            <Button
              variant="ghost"
              size="sm"
              className="flex flex-col items-center gap-1 h-auto py-2 px-3 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-all duration-200"
            >
              <Download className="h-5 w-5" />
              <span className="text-xs font-medium">Export</span>
            </Button>
          </ExportModal>
        </div>
      </div>
    </div>
  );
}