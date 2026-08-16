import { SidebarProvider } from '@/components/ui/sidebar';
import { useState } from 'react';

interface AppShellProps {
    children: React.ReactNode;
    variant?: 'header' | 'sidebar';
}

export function AppShell({ children, variant = 'header' }: AppShellProps) {
    const [isOpen, setIsOpen] = useState(false);

    if (variant === 'header') {
        return <div className="flex min-h-dvh w-full flex-col">{children}</div>;
    }

    return (
        <SidebarProvider defaultOpen={isOpen} open={isOpen} onOpenChange={setIsOpen}>
            {children}
        </SidebarProvider>
    );
}
