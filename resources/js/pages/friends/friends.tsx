import { FriendsSidebar } from '@/components/friends-sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Check, Clock, UserCheck, UserPlus, X } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Friends',
        href: '/friends',
    },
];

interface FriendRequestItem {
    id: number;
    sender: { id: number; name: string; email: string; avatar_url?: string | null };
    created_at: string;
}

type UserStatus = 'none' | 'pending_sent' | 'pending_received' | 'friends';

interface UserItem {
    id: number;
    name: string;
    email: string;
    avatar_url?: string | null;
    status: UserStatus;
    request_id: number | null;
}

interface FriendsProps {
    requests: FriendRequestItem[];
    users: UserItem[];
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export default function Friends({ requests, users }: FriendsProps) {
    const [localRequests, setLocalRequests] = useState(requests);
    const [statusOverrides, setStatusOverrides] = useState<Record<number, UserStatus>>({});
    const [busyId, setBusyId] = useState<number | null>(null);

    const handleAccept = (requestId: number, senderId: number) => {
        setBusyId(requestId);
        router.post(
            route('friends.accept', requestId),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setLocalRequests((prev) => prev.filter((r) => r.id !== requestId));
                    setStatusOverrides((prev) => ({ ...prev, [senderId]: 'friends' }));
                },
                onFinish: () => setBusyId(null),
            },
        );
    };

    const handleDecline = (requestId: number, senderId: number) => {
        setBusyId(requestId);
        router.delete(route('friends.decline', requestId), {
            preserveScroll: true,
            onSuccess: () => {
                setLocalRequests((prev) => prev.filter((r) => r.id !== requestId));
                setStatusOverrides((prev) => ({ ...prev, [senderId]: 'none' }));
            },
            onFinish: () => setBusyId(null),
        });
    };

    const handleAdd = (userId: number) => {
        setBusyId(userId);
        router.post(
            route('friends.sendRequest', userId),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setStatusOverrides((prev) => ({ ...prev, [userId]: 'pending_sent' }));
                },
                onFinish: () => setBusyId(null),
            },
        );
    };

    const statusOf = (user: UserItem): UserStatus => statusOverrides[user.id] ?? user.status;

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Friends" />
            <div className="flex h-full flex-1 flex-col md:flex-row">
                <FriendsSidebar active="/friends" />

                <div className="flex flex-1 flex-col gap-6 p-4 sm:p-6">
                    {/* Friend requests */}
                    <div className="flex flex-col gap-3">
                        <h1 className="text-lg font-semibold">Friend requests</h1>

                        {localRequests.length === 0 ? (
                            <p className="text-muted-foreground text-sm">No pending friend requests.</p>
                        ) : (
                            <div className="flex flex-col gap-2">
                                {localRequests.map((req) => {
                                    const isBusy = busyId === req.id;
                                    return (
                                        <div
                                            key={req.id}
                                            className="border-sidebar-border/70 bg-background dark:border-sidebar-border flex flex-col gap-3 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between"
                                        >
                                            <div className="flex items-center gap-3">
                                                <Avatar className="size-10 shrink-0">
                                                    {req.sender.avatar_url ? (
                                                        <AvatarImage src={req.sender.avatar_url} alt={req.sender.name} />
                                                    ) : (
                                                        <AvatarFallback className="text-sm font-semibold">
                                                            {getInitials(req.sender.name)}
                                                        </AvatarFallback>
                                                    )}
                                                </Avatar>
                                                <div className="flex min-w-0 flex-col">
                                                    <span className="truncate text-sm font-medium">{req.sender.name}</span>
                                                    <span className="text-muted-foreground text-xs">{req.created_at}</span>
                                                </div>
                                            </div>

                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => handleAccept(req.id, req.sender.id)}
                                                    className="bg-primary text-primary-foreground hover:bg-primary/90 flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 sm:flex-none"
                                                >
                                                    <Check className="size-4" />
                                                    Accept
                                                </button>
                                                <button
                                                    type="button"
                                                    disabled={isBusy}
                                                    onClick={() => handleDecline(req.id, req.sender.id)}
                                                    className="bg-muted text-muted-foreground hover:bg-muted/80 flex flex-1 items-center justify-center gap-1 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60 sm:flex-none"
                                                >
                                                    <X className="size-4" />
                                                    Decline
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>

                    {/* All users */}
                    <div className="flex flex-col gap-3">
                        <h2 className="text-lg font-semibold">All users</h2>

                        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                            {users.map((user) => {
                                const status = statusOf(user);
                                const isBusy = busyId === user.id;

                                return (
                                    <div
                                        key={user.id}
                                        className="border-sidebar-border/70 bg-background dark:border-sidebar-border flex flex-col items-center gap-3 rounded-xl border p-4 text-center"
                                    >
                                        <Avatar className="size-16">
                                            {user.avatar_url ? (
                                                <AvatarImage src={user.avatar_url} alt={user.name} />
                                            ) : (
                                                <AvatarFallback className="text-lg font-semibold">{getInitials(user.name)}</AvatarFallback>
                                            )}
                                        </Avatar>

                                        <div className="flex min-w-0 flex-col">
                                            <span className="truncate text-sm font-medium">{user.name}</span>
                                            <span className="text-muted-foreground truncate text-xs">{user.email}</span>
                                        </div>

                                        {status === 'friends' && (
                                            <span className="bg-muted text-muted-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
                                                <UserCheck className="size-4" />
                                                Friends
                                            </span>
                                        )}

                                        {status === 'pending_sent' && (
                                            <span className="bg-muted text-muted-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
                                                <Clock className="size-4" />
                                                Requested
                                            </span>
                                        )}

                                        {status === 'pending_received' && (
                                            <span className="bg-muted text-muted-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium">
                                                <Clock className="size-4" />
                                                Respond above
                                            </span>
                                        )}

                                        {status === 'none' && (
                                            <button
                                                type="button"
                                                disabled={isBusy}
                                                onClick={() => handleAdd(user.id)}
                                                className="bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60"
                                            >
                                                <UserPlus className="size-4" />
                                                {isBusy ? 'Sending...' : 'Add'}
                                            </button>
                                        )}
                                    </div>
                                );
                            })}

                            {users.length === 0 && <p className="text-muted-foreground col-span-full text-sm">No users found.</p>}
                        </div>
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
