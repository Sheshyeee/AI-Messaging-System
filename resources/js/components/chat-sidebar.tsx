import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';
import { Link } from '@inertiajs/react';
import { BellOff, MoreHorizontal, Search, SquarePen } from 'lucide-react';
import { useMemo, useState } from 'react';

export interface ParticipantAvatar {
    avatar?: string;
    name: string;
}

export interface ChatPreviewItem {
    id: number;
    name: string;
    lastMessage: string;
    lastMessageFromMe: boolean;
    timestamp: string;
    unread?: boolean;
    unreadCount?: number;
    muted?: boolean;
    online?: boolean;
    friendId?: number;
    isGroup?: boolean;
    lastMessageSenderName?: string | null;
    avatarUrl?: string | null;
    participantAvatars?: ParticipantAvatar[];
    participantIds?: number[];
}

interface ChatSidebarProps {
    chats: ChatPreviewItem[];
    friends: FriendItem[];
    isLoading?: boolean;
    activeId?: number;
    onSelectConversation: (chat: {
        id: number;
        name: string;
        friendId?: number;
        avatarUrl?: string | null;
        isGroup?: boolean;
        participantIds?: number[];
    }) => void;
    onSelectFriend: (friend: { id: number; name: string }) => void;
    onNewGroup: () => void; // NEW
}

export interface FriendItem {
    id: number;
    name: string;
    online?: boolean;
}

const filters = ['All', 'Unread', 'Groups'] as const;

function getInitials(name: string) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function ChatSidebar({ chats, friends, isLoading, activeId, onSelectConversation, onSelectFriend, onNewGroup }: ChatSidebarProps) {
    const [filter, setFilter] = useState<(typeof filters)[number]>('All');
    const [query, setQuery] = useState('');

    const isSearching = query.trim().length > 0;

    const searchResults = useMemo(() => {
        if (!isSearching) return [];
        const q = query.trim().toLowerCase();
        return friends.filter((friend) => friend.name.toLowerCase().includes(q));
    }, [query, isSearching, friends]);

    const visibleChats = useMemo(() => {
        if (filter === 'Unread') return chats.filter((c) => c.unread);
        if (filter === 'Groups') return chats.filter((c) => c.isGroup);
        return chats;
    }, [chats, filter]);

    const selectConversation = (chat: {
        id: number;
        name: string;
        friendId?: number;
        avatarUrl?: string | null;
        isGroup?: boolean;
        participantIds?: number[];
    }) => {
        setQuery('');
        onSelectConversation(chat);
    };

    const selectFriend = (friend: { id: number; name: string }) => {
        setQuery('');
        onSelectFriend(friend);
    };

    return (
        <aside className="border-sidebar-border/70 bg-background dark:border-sidebar-border flex w-full shrink-0 flex-col border-r md:max-w-[320px]">
            {/* Header */}
            <div className="flex items-center justify-between px-4 pt-3 pb-2">
                <h2 className="text-xl font-semibold tracking-tight">Chats</h2>
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        className="text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-full transition-colors"
                        aria-label="Options"
                    >
                        <MoreHorizontal className="size-5" />
                    </button>
                    <button
                        type="button"
                        className="bg-muted text-foreground hover:bg-accent flex size-9 items-center justify-center rounded-full transition-colors"
                        aria-label="New group"
                        onClick={onNewGroup}
                    >
                        <SquarePen className="size-4" />
                    </button>
                </div>
            </div>

            {/* Search */}
            <div className="px-3 pb-2">
                <div className="bg-muted flex items-center gap-2 rounded-full px-3 py-2">
                    <Search className="text-muted-foreground size-4" />
                    <input
                        type="text"
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search Messenger"
                        className="placeholder:text-muted-foreground w-full bg-transparent text-sm outline-none"
                    />
                </div>
            </div>

            {/* Filter tabs — hidden while searching, like Messenger */}
            {!isSearching && (
                <div className="flex items-center gap-2 px-3 pb-2">
                    {filters.map((item) => (
                        <button
                            key={item}
                            type="button"
                            onClick={() => setFilter(item)}
                            className={cn(
                                'rounded-full px-3 py-1.5 text-sm font-medium transition-colors',
                                filter === item ? 'bg-primary/10 text-primary' : 'text-foreground hover:bg-accent',
                            )}
                        >
                            {item}
                        </button>
                    ))}
                </div>
            )}

            {/* Either search results or the normal conversation list */}
            <nav className="flex flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-2">
                {isLoading ? (
                    <p className="text-muted-foreground px-2 py-4 text-center text-sm">Loading chats…</p>
                ) : isSearching ? (
                    searchResults.length > 0 ? (
                        searchResults.map((friend) => (
                            <button
                                key={friend.id}
                                type="button"
                                onClick={() => selectFriend({ id: friend.id, name: friend.name })}
                                className="hover:bg-accent flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors"
                            >
                                <div className="relative shrink-0">
                                    <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full text-sm font-semibold">
                                        {getInitials(friend.name)}
                                    </div>
                                    {friend.online && (
                                        <span className="border-background absolute right-0 bottom-0 size-3 rounded-full border-2 bg-green-500" />
                                    )}
                                </div>
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="truncate text-sm font-medium">{friend.name}</span>
                                    <span className="text-muted-foreground text-xs">Tap to message</span>
                                </div>
                            </button>
                        ))
                    ) : (
                        <p className="text-muted-foreground px-2 py-4 text-center text-sm">No friends found.</p>
                    )
                ) : visibleChats.length > 0 ? (
                    visibleChats.map((chat) => {
                        const isActive = activeId === chat.id;

                        return (
                            <Link
                                key={chat.id}
                                href={route('chats.show', chat.id)}
                                prefetch="hover"
                                cacheFor="30s"
                                onClick={(e) => {
                                    e.preventDefault();
                                    selectConversation({
                                        id: chat.id,
                                        name: chat.name,
                                        friendId: chat.friendId,
                                        avatarUrl: chat.avatarUrl,
                                        isGroup: chat.isGroup,
                                        participantIds: chat.participantIds,
                                    });
                                }}
                                className={cn(
                                    'flex items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors',
                                    isActive ? 'bg-primary/10' : 'hover:bg-accent',
                                )}
                            >
                                <div className="relative shrink-0">
                                    {chat.avatarUrl ? (
                                        <Avatar className="overflow-hidden">
                                            <AvatarImage src={chat.avatarUrl} alt={chat.name} />
                                            <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
                                        </Avatar>
                                    ) : chat.isGroup ? (
                                        <div className="relative flex h-12 w-12 items-center justify-center">
                                            {(chat.participantAvatars?.slice(0, 2) ?? []).map((participant, index) => (
                                                <div
                                                    key={participant.name}
                                                    className={cn(
                                                        'border-background absolute overflow-hidden rounded-full border-2',
                                                        index === 0 ? 'top-0 left-0' : 'right-0 bottom-0',
                                                        index === 0 && chat.participantAvatars?.length === 1 ? 'relative top-0 left-0' : '',
                                                    )}
                                                >
                                                    <Avatar className="size-8">
                                                        {participant.avatar ? (
                                                            <AvatarImage src={participant.avatar} alt={participant.name} />
                                                        ) : (
                                                            <AvatarFallback className="text-xs">{getInitials(participant.name)}</AvatarFallback>
                                                        )}
                                                    </Avatar>
                                                </div>
                                            ))}
                                            {(!chat.participantAvatars || chat.participantAvatars.length === 0) && (
                                                <Avatar className="size-12">
                                                    <AvatarFallback>{getInitials(chat.name)}</AvatarFallback>
                                                </Avatar>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-muted text-muted-foreground flex size-12 items-center justify-center rounded-full text-sm font-semibold">
                                            {getInitials(chat.name)}
                                        </div>
                                    )}
                                    {chat.online && (
                                        <span className="border-background absolute right-0 bottom-0 size-3 rounded-full border-2 bg-green-500" />
                                    )}
                                </div>

                                <div className="flex min-w-0 flex-1 flex-col">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className={cn('truncate text-sm', chat.unread ? 'font-semibold' : 'font-medium')}>{chat.name}</span>
                                        <div className="flex shrink-0 items-center gap-1.5">
                                            <span className={cn('text-xs', chat.unread ? 'text-foreground font-medium' : 'text-muted-foreground')}>
                                                {chat.timestamp}
                                            </span>
                                            {chat.unread && !chat.lastMessageFromMe && (
                                                <span className="bg-primary size-2.5 shrink-0 rounded-full" aria-hidden="true" />
                                            )}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <span
                                            className={cn(
                                                'truncate text-xs',
                                                chat.unread ? 'text-foreground font-semibold' : 'text-muted-foreground',
                                            )}
                                        >
                                            {chat.lastMessageFromMe
                                                ? `You: ${chat.lastMessage}`
                                                : chat.isGroup && chat.lastMessageSenderName
                                                  ? `${chat.lastMessageSenderName}: ${chat.lastMessage}`
                                                  : chat.lastMessage}
                                        </span>
                                        {chat.muted && <BellOff className="text-muted-foreground size-4 shrink-0" />}
                                    </div>
                                </div>
                            </Link>
                        );
                    })
                ) : (
                    <p className="text-muted-foreground px-2 py-4 text-center text-sm">No conversations yet.</p>
                )}
            </nav>
        </aside>
    );
}
