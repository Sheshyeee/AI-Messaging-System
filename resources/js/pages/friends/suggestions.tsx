import { FriendsSidebar } from '@/components/friends-sidebar';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import AppLayout from '@/layouts/app-layout';
import { type BreadcrumbItem } from '@/types';
import { Head, router } from '@inertiajs/react';
import { Check, UserPlus } from 'lucide-react';
import { useState } from 'react';

const breadcrumbs: BreadcrumbItem[] = [
    {
        title: 'Friends',
        href: '/friends',
    },
    {
        title: 'Suggestions',
        href: '/friends/suggestions',
    },
];

interface UserItem {
    id: number;
    name: string;
    email: string;
    avatar_url?: string | null;
}

interface SuggestionsProps {
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

export default function Suggestions({ users }: SuggestionsProps) {
    const [sentIds, setSentIds] = useState<number[]>([]);
    const [loadingId, setLoadingId] = useState<number | null>(null);

    const handleAdd = (userId: number) => {
        setLoadingId(userId);

        router.post(
            route('friends.sendRequest', userId),
            {},
            {
                preserveScroll: true,
                onSuccess: () => {
                    setSentIds((prev) => [...prev, userId]);
                },
                onFinish: () => {
                    setLoadingId(null);
                },
            },
        );
    };

    return (
        <AppLayout breadcrumbs={breadcrumbs}>
            <Head title="Suggestions" />
            <div className="flex h-full flex-1 flex-col md:flex-row">
                <FriendsSidebar active="/friends/suggestions" />

                <div className="flex flex-1 flex-col gap-4 p-4 sm:p-6">
                    <h1 className="text-lg font-semibold">People you may know</h1>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                        {users.map((user) => {
                            const isSent = sentIds.includes(user.id);
                            const isLoading = loadingId === user.id;

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

                                    <button
                                        type="button"
                                        disabled={isSent || isLoading}
                                        onClick={() => handleAdd(user.id)}
                                        className={
                                            isSent
                                                ? 'bg-muted text-muted-foreground flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium'
                                                : 'bg-primary text-primary-foreground hover:bg-primary/90 flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors disabled:opacity-60'
                                        }
                                    >
                                        {isSent ? (
                                            <>
                                                <Check className="size-4" />
                                                Request sent
                                            </>
                                        ) : (
                                            <>
                                                <UserPlus className="size-4" />
                                                {isLoading ? 'Sending...' : 'Add'}
                                            </>
                                        )}
                                    </button>
                                </div>
                            );
                        })}

                        {users.length === 0 && <p className="text-muted-foreground col-span-full text-sm">No suggestions right now.</p>}
                    </div>
                </div>
            </div>
        </AppLayout>
    );
}
