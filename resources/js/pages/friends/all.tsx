import { FriendsSidebar } from '@/components/friends-sidebar';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Friends',
        href: '/friends',
    },
    {
        title: 'All friends',
        href: '/friends/all',
    },
];

interface FriendItem {
    id: number;
    name: string;
    email: string;
    friends_since: string;
}

interface AllFriendsProps {
    friends: FriendItem[];
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export default function AllFriends({ friends }: AllFriendsProps) {
    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="All Friends" />
            <div className="flex h-full flex-1 flex-col md:flex-row">
                <FriendsSidebar active="/friends/all" />

                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                    <h1 className="text-lg font-semibold">
                        All friends <span className="text-muted-foreground">({friends.length})</span>
                    </h1>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {friends.map((friend) => (
                            <div
                                key={friend.id}
                                className="border-sidebar-border/70 bg-background dark:border-sidebar-border flex flex-col items-center gap-3 rounded-xl border p-4 text-center"
                            >
                                <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full text-lg font-semibold">
                                    {getInitials(friend.name)}
                                </div>

                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-medium">{friend.name}</span>
                                    <span className="text-muted-foreground truncate text-xs">{friend.email}</span>
                                </div>

                                <span className="text-muted-foreground text-xs">Friends since {friend.friends_since}</span>
                            </div>
                        ))}

                        {friends.length === 0 && (
                            <p className="text-muted-foreground col-span-full text-sm">
                                You don't have any friends yet. Check{' '}
                                <a href="/friends/suggestions" className="text-primary underline">
                                    suggestions
                                </a>{' '}
                                to add some.
                            </p>
                        )}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}