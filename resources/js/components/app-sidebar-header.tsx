import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { SidebarTrigger } from '@/components/ui/sidebar';
import { UserMenuContent } from '@/components/user-menu-content';
import { useInitials } from '@/hooks/use-initials';
import { type BreadcrumbItem as BreadcrumbItemType, type SharedData } from '@/types';
import { usePage } from '@inertiajs/react';
import { Menu } from 'lucide-react';

export function AppSidebarHeader({ breadcrumbs = [] }: { breadcrumbs?: BreadcrumbItemType[] }) {
    const { auth } = usePage<SharedData>().props;
    const getInitials = useInitials();

    return (
        <header className="bg-background/80 sticky top-0 z-20 flex h-14 shrink-0 items-center gap-2 border-b px-4 backdrop-blur-md md:hidden">
            <SidebarTrigger className="h-9 w-9 rounded-full" aria-label="Open navigation menu">
                <Menu className="size-5" />
            </SidebarTrigger>
            <div className="flex min-w-0 flex-1 items-center gap-2">
                {breadcrumbs.length > 0 && <span className="truncate text-sm font-semibold">{breadcrumbs[breadcrumbs.length - 1].title}</span>}
            </div>

            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <button className="ring-sidebar-ring shrink-0 rounded-full outline-none focus-visible:ring-2" aria-label="Open account menu">
                        <Avatar className="h-9 w-9 overflow-hidden rounded-full">
                            <AvatarImage src={auth.user.avatar} alt={auth.user.name} />
                            <AvatarFallback className="rounded-full bg-neutral-200 text-black dark:bg-neutral-700 dark:text-white">
                                {getInitials(auth.user.name)}
                            </AvatarFallback>
                        </Avatar>
                    </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56 rounded-lg" align="end" side="bottom">
                    <UserMenuContent user={auth.user} />
                </DropdownMenuContent>
            </DropdownMenu>
        </header>
    );
}
