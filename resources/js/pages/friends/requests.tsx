import { FriendsSidebar } from '@/components/friends-sidebar';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Friends',
        href: '/friends',
    },
    {
        title: 'Friend requests',
        href: '/friends/requests',
    },
];

interface FriendRequestItem {
    id: number;
    sender: {
        id: number;
        name: string;
        email: string;
    };
    created_at: string;
}

interface RequestsProps {
    requests: FriendRequestItem[];
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export default function Requests({ requests }: RequestsProps) {
    const handleAccept = (id: number) => {
        router.post(route('friends.accept', id), {}, { preserveScroll: true });
    };

    const handleDecline = (id: number) => {
        router.delete(route('friends.decline', id), { preserveScroll: true });
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Friend Requests" />
            <div className="flex h-full flex-1 flex-col md:flex-row">
                <FriendsSidebar active="/friends/requests" />

                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                    <h1 className="text-lg font-semibold">Friend requests</h1>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {requests.map((req) => (
                            <div
                                key={req.id}
                                className="border-sidebar-border/70 bg-background dark:border-sidebar-border flex flex-col items-center gap-3 rounded-xl border p-4 text-center"
                            >
                                <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-full text-lg font-semibold">
                                    {getInitials(req.sender.name)}
                                </div>

                                <div className="flex min-w-0 flex-col">
                                    <span className="truncate text-sm font-medium">{req.sender.name}</span>
                                    <span className="text-muted-foreground text-xs">{req.created_at}</span>
                                </div>

                                <div className="flex w-full flex-col gap-2">
                                    <button
                                        type="button"
                                        onClick={() => handleAccept(req.id)}
                                        className="bg-primary text-primary-foreground hover:bg-primary/90 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                                    >
                                        Confirm
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => handleDecline(req.id)}
                                        className="bg-muted text-muted-foreground hover:bg-muted/80 w-full rounded-lg px-3 py-2 text-sm font-medium transition-colors"
                                    >
                                        Delete
                                    </button>
                                </div>
                            </div>
                        ))}

                        {requests.length === 0 && <p className="text-muted-foreground col-span-full text-sm">No pending friend requests.</p>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}