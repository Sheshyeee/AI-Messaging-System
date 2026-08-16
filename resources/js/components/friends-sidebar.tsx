import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { ChevronRight, Settings, UserPlus, Users, UserSearch, type LucideIcon } from 'lucide-react';

interface FriendsNavItem {
    title: string;
    href: string;
    icon: LucideIcon;
    expandable?: boolean;
}

const items: FriendsNavItem[] = [
    { title: 'Home', href: '/friends', icon: Users },
    { title: 'Requests', href: '/friends/requests', icon: UserPlus, expandable: true },
    { title: 'Suggestions', href: '/friends/suggestions', icon: UserSearch, expandable: true },
    { title: 'All friends', href: '/friends/all', icon: Users, expandable: true },
];

interface FriendsSidebarProps {
    active?: string;
}

export function FriendsSidebar({ active = '/friends' }: FriendsSidebarProps) {
    return (
        <>
            {/* Mobile: horizontal scrollable nav */}
            <nav
                aria-label="Friends sections"
                className="border-sidebar-border/70 bg-background/80 dark:border-sidebar-border sticky top-14 z-10 flex shrink-0 items-center gap-1 overflow-x-auto border-b px-3 py-2 backdrop-blur-md md:hidden"
            >
                {items.map((item) => {
                    const isActive = active === item.href;
                    const Icon = item.icon;

                    return (
                        <Link
                            key={item.href}
                            href={item.href}
                            className={cn(
                                'flex shrink-0 items-center gap-2 rounded-full px-3.5 py-2 text-sm font-medium transition-colors',
                                isActive ? 'bg-primary text-primary-foreground' : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                            )}
                        >
                            <Icon className="size-4" />
                            <span>{item.title}</span>
                        </Link>
                    );
                })}
            </nav>

            {/* Desktop: sidebar */}
            <aside className="border-sidebar-border/70 bg-background dark:border-sidebar-border hidden w-full max-w-[260px] shrink-0 flex-col gap-1 border-r px-2 py-3 md:flex">
                <div className="flex items-center justify-between px-2 pb-2">
                    <h2 className="text-xl font-semibold tracking-tight">Friends</h2>
                    <button
                        type="button"
                        className="text-muted-foreground hover:bg-accent hover:text-accent-foreground flex size-8 items-center justify-center rounded-full transition-colors"
                        aria-label="Friends settings"
                    >
                        <Settings className="size-4" />
                    </button>
                </div>

                <nav className="flex flex-col gap-0.5">
                    {items.map((item) => {
                        const isActive = active === item.href;
                        const Icon = item.icon;

                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-2 py-2 text-sm font-medium transition-colors',
                                    isActive ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent hover:text-accent-foreground',
                                )}
                            >
                                <span
                                    className={cn(
                                        'flex size-8 shrink-0 items-center justify-center rounded-full',
                                        isActive ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground',
                                    )}
                                >
                                    <Icon className="size-4" />
                                </span>
                                <span className="flex-1">{item.title}</span>
                                {item.expandable && <ChevronRight className="text-muted-foreground size-4" />}
                            </Link>
                        );
                    })}
                </nav>
            </aside>
        </>
    );
}