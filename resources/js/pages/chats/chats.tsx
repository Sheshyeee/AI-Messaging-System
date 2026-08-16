import AppLayout from '@/layouts/app-layout';
import { cn } from '@/lib/utils';
import { router, usePage } from '@inertiajs/react';
import { useEffect, useState } from 'react';

import { ChatSidebar, type ChatPreviewItem, type FriendItem } from '@/components/chat-sidebar';

import { ConversationInfoPanel } from '@/components/conversation-info-panel';
import { MessageThread, type MessageItem } from '@/components/message-thread';
import { NewGroupDialog } from '@/components/new-group-dialog';

interface ActiveConversation {
    id: number;
    name: string;
    friendId: number | null;
    isGroup: boolean;
    avatarUrl?: string | null;
    participants: { id: number; name: string; avatar?: string | null }[];
    participantIds?: number[];
    participantCount?: number;
}

interface ConversationApiItem {
    id: number;
    name: string;
    friend_id: number | null;
    is_group: boolean;
    last_message: string;
    last_message_from_me: boolean;
    last_message_sender_name: string | null;
    timestamp: string;
    unread: boolean;
    unread_count: number;
    avatar_url?: string | null;
    participant_avatars?: { id: number; name: string; avatar?: string | null }[];
    participant_ids?: number[];
}

interface ChatsPageProps {
    conversations: ConversationApiItem[];
    friends: FriendItem[];
    activeConversation?: ActiveConversation;
    messages?: MessageItem[];
}

interface ConversationRealtimeUpdate {
    id: number;
    name: string;
    friend_id: number | null;
    is_group: boolean;
    last_message: string;
    last_message_from_me: boolean;
    last_message_sender_name?: string | null;
    timestamp: string;
    sort_time: number;
    unread: boolean;
    unread_count: number;
    participant_ids?: number[];
}

interface PresenceUser {
    id: number;
    name: string;
}

// Matches Tailwind's `lg` breakpoint — the info panel defaults open at this
// width and up, and closed below it.
const DESKTOP_QUERY = '(min-width: 1024px)';
const MOBILE_QUERY = '(max-width: 767px)';

function mapChat(c: ConversationApiItem): ChatPreviewItem {
    return {
        id: c.id,
        name: c.name,
        friendId: c.friend_id ?? undefined,
        isGroup: c.is_group,
        lastMessage: c.last_message,
        lastMessageFromMe: c.last_message_from_me,
        lastMessageSenderName: c.last_message_sender_name,
        timestamp: c.timestamp,
        unread: c.unread,
        unreadCount: c.unread_count,
        avatarUrl: c.avatar_url ?? null,
        participantAvatars: c.participant_avatars?.map((avatar) => ({
            id: avatar.id,
            name: avatar.name,
            avatar: avatar.avatar ?? undefined,
        })),
        participantIds: c.participant_ids ?? [],
    };
}

export default function Chats({ conversations, friends, activeConversation, messages = [] }: ChatsPageProps) {
    const { auth } = usePage().props as unknown as { auth: { user: { id: number; name: string } } };

    const [infoOpen, setInfoOpen] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(DESKTOP_QUERY).matches : true));
    const [newGroupOpen, setNewGroupOpen] = useState(false);
    const [isMobile, setIsMobile] = useState(() => (typeof window !== 'undefined' ? window.matchMedia(MOBILE_QUERY).matches : false));
    // Tracks whether the thread is showing on mobile (list hidden)
    const [mobileThreadOpen, setMobileThreadOpen] = useState(false);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(DESKTOP_QUERY);
        const handleChange = (e: MediaQueryListEvent) => setInfoOpen(e.matches);
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

    useEffect(() => {
        if (typeof window === 'undefined') return;
        const mql = window.matchMedia(MOBILE_QUERY);
        const handleChange = (e: MediaQueryListEvent) => {
            setIsMobile(e.matches);
            if (!e.matches) setMobileThreadOpen(false);
        };
        mql.addEventListener('change', handleChange);
        return () => mql.removeEventListener('change', handleChange);
    }, []);

    const [chats, setChats] = useState<ChatPreviewItem[]>(() => conversations.map(mapChat));

    useEffect(() => {
        setChats(conversations.map(mapChat));
    }, [conversations]);

    // Per-conversation message cache — lets a re-opened thread render
    // instantly from what we already fetched, instead of a blank/loading
    // flash while Inertia's request round-trips again.
    const [messageCache, setMessageCache] = useState<Record<number, MessageItem[]>>({});

    useEffect(() => {
        if (!activeConversation || messages.length === 0) return;
        setMessageCache((prev) => ({ ...prev, [activeConversation.id]: messages }));
    }, [activeConversation, messages]);

    // Local "which thread is open" state that can flip the instant a chat
    // is clicked — decoupled from the real `activeConversation` prop, which
    // only updates once the server round-trip resolves. This is what kills
    // the visible waiting time on repeat opens of a thread.
    const [localActive, setLocalActive] = useState<ActiveConversation | undefined>(activeConversation);

    useEffect(() => {
        setLocalActive(activeConversation);
    }, [activeConversation]);

    const effectiveActive = localActive ?? activeConversation;

    // Prefer cached messages for whatever thread is *actually* showing.
    // If we just optimistically switched to a thread ahead of the server
    // confirming it (cache hit), and the incoming `messages` prop still
    // belongs to the previous thread, don't show stale messages under the
    // new header — show the cached set instead.
    const displayMessages = (() => {
        if (!effectiveActive) return [];
        const cached = messageCache[effectiveActive.id];
        if (cached) return cached;
        if (activeConversation?.id === effectiveActive.id) return messages;
        return [];
    })();

    // Realtime sidebar updates: listen on our own private user channel for
    // new-message previews on conversations we don't currently have open.
    useEffect(() => {
        if (!auth?.user?.id) return;

        const channel = window.Echo.private(`App.Models.User.${auth.user.id}`);

        channel.listen('.ConversationUpdated', (e: { conversation: ConversationRealtimeUpdate }) => {
            const incoming = e.conversation;

            // If this conversation is the one currently open, the thread's
            // own read-receipt flow will mark it read almost immediately —
            // don't flash an unread badge for a chat the user is looking at.
            const isOpenRightNow = effectiveActive?.id === incoming.id;

            setChats((prev) => {
                const existingIndex = prev.findIndex((c) => c.id === incoming.id);
                const patched: ChatPreviewItem = {
                    id: incoming.id,
                    name: incoming.name,
                    friendId: incoming.friend_id ?? undefined,
                    isGroup: incoming.is_group,
                    lastMessage: incoming.last_message,
                    lastMessageFromMe: incoming.last_message_from_me,
                    timestamp: incoming.timestamp,
                    unread: isOpenRightNow ? false : incoming.unread,
                    unreadCount: isOpenRightNow ? 0 : incoming.unread_count,
                    participantIds: incoming.participant_ids ?? prev[existingIndex]?.participantIds ?? [],
                };

                const next = existingIndex >= 0 ? prev.map((c, i) => (i === existingIndex ? patched : c)) : [patched, ...prev];

                return next.sort((a, b) => {
                    if (a.id === incoming.id) return -1;
                    if (b.id === incoming.id) return 1;
                    return 0;
                });
            });
        });

        return () => {
            window.Echo.leave(`App.Models.User.${auth.user.id}`);
        };
    }, [auth?.user?.id, effectiveActive?.id]);

    // Presence channel: tracks who's currently connected app-wide, for the
    // green "online" dot and "Active now" header text.
    const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

    useEffect(() => {
        if (!auth?.user?.id) return;

        window.Echo.join('online-users')
            .here((users: PresenceUser[]) => {
                setOnlineUserIds(new Set(users.map((u) => u.id)));
            })
            .joining((user: PresenceUser) => {
                setOnlineUserIds((prev) => new Set(prev).add(user.id));
            })
            .leaving((user: PresenceUser) => {
                setOnlineUserIds((prev) => {
                    const next = new Set(prev);
                    next.delete(user.id);
                    return next;
                });
            });

        return () => {
            window.Echo.leave('online-users');
        };
    }, [auth?.user?.id]);

    const selectConversation = (chat: {
        id: number;
        name: string;
        friendId?: number;
        avatarUrl?: string | null;
        isGroup?: boolean;
        participantIds?: number[];
    }) => {
        if (messageCache[chat.id]) {
            const cachedChat = chats.find((c) => c.id === chat.id);
            setLocalActive({
                id: chat.id,
                name: chat.name,
                friendId: chat.friendId ?? cachedChat?.friendId ?? null,
                isGroup: chat.isGroup ?? cachedChat?.isGroup ?? false,
                avatarUrl: chat.avatarUrl,
                participants: [],
                participantIds: chat.participantIds ?? cachedChat?.participantIds,
                participantCount:
                    chat.isGroup || cachedChat?.isGroup ? (chat.participantIds?.length ?? cachedChat?.participantIds?.length ?? 0) + 1 : undefined,
            });
        }

        setChats((prev) => prev.map((c) => (c.id === chat.id ? { ...c, unread: false, unreadCount: 0 } : c)));

        // On mobile, hide the list and show the thread
        if (isMobile) setMobileThreadOpen(true);

        router.visit(route('chats.show', chat.id), {
            preserveState: true,
            preserveScroll: true,
            // `conversations` dropped from here — it doesn't change just by
            // opening a thread, only by sending a message or a realtime
            // event, both already handled elsewhere. Cuts one query out of
            // every single click.
            only: ['activeConversation', 'messages'],
        });
    };

    const selectFriend = (friend: { id: number; name: string }) => {
        router.post(route('chats.start'), { friend_id: friend.id });
    };

    const handleBackToList = () => {
        setMobileThreadOpen(false);
        setInfoOpen(false);
    };

    return (
        <AppLayout breadcrumbs={[{ title: 'Chats', href: '/chats' }]}>
            <div className="flex h-[calc(100dvh-3.5rem)] md:h-[calc(100dvh-4rem)]">
                {/* Conversation list — hidden on mobile when a thread is open */}
                <div className={cn('w-full md:w-auto', isMobile && mobileThreadOpen ? 'hidden' : '')}>
                    <ChatSidebar
                        chats={chats.map((c) => ({
                            ...c,
                            online: c.isGroup
                                ? (c.participantIds ?? []).some((id) => onlineUserIds.has(id))
                                : c.friendId !== undefined && onlineUserIds.has(c.friendId),
                        }))}
                        friends={friends.map((f) => ({ ...f, online: onlineUserIds.has(f.id) }))}
                        activeId={effectiveActive?.id}
                        onSelectConversation={selectConversation}
                        onSelectFriend={selectFriend}
                        onNewGroup={() => setNewGroupOpen(true)}
                    />
                </div>

                <NewGroupDialog friends={friends} open={newGroupOpen} onClose={() => setNewGroupOpen(false)} />
                {effectiveActive ? (
                    <div className={cn('flex min-w-0 flex-1', isMobile && !mobileThreadOpen ? 'hidden' : '')}>
                        <div className="min-w-0 flex-1">
                            <MessageThread
                                key={effectiveActive.id}
                                conversationId={effectiveActive.id}
                                chatName={effectiveActive.name}
                                messages={displayMessages}
                                onToggleInfo={() => setInfoOpen((v) => !v)}
                                currentUserId={auth.user.id}
                                 avatarUrl={effectiveActive.avatarUrl}
                                currentUserName={auth.user.name}
                                onBack={isMobile ? handleBackToList : undefined}
                                isOnline={
                                    effectiveActive.isGroup
                                        ? effectiveActive.participants.length > 0
                                            ? effectiveActive.participants.some((p) => p.id !== auth.user.id && onlineUserIds.has(p.id))
                                            : (effectiveActive.participantIds ?? []).some((id) => onlineUserIds.has(id))
                                        : effectiveActive.friendId != null && onlineUserIds.has(effectiveActive.friendId)
                                }
                                isGroup={effectiveActive.isGroup}
                                participantCount={
                                    effectiveActive.isGroup
                                        ? effectiveActive.participants.length > 0
                                            ? effectiveActive.participants.length
                                            : (effectiveActive.participantCount ??
                                              (effectiveActive.participantIds ? effectiveActive.participantIds.length + 1 : undefined))
                                        : undefined
                                }
                            />
                        </div>

                        {infoOpen && (
                            <>
                                <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setInfoOpen(false)} aria-hidden="true" />
                                <div className="fixed inset-y-0 right-0 z-40 w-full max-w-[320px] lg:static lg:z-auto lg:w-[320px] lg:shrink-0">
                                    <ConversationInfoPanel
                                        conversationId={effectiveActive.id}
                                        chatName={effectiveActive.name}
                                        avatarUrl={effectiveActive.avatarUrl}
                                        messages={displayMessages}
                                        onClose={() => setInfoOpen(false)}
                                        isFriendOnline={
                                            !effectiveActive.isGroup &&
                                            effectiveActive.friendId != null &&
                                            onlineUserIds.has(effectiveActive.friendId)
                                        }
                                        isGroup={effectiveActive.isGroup}
                                        participants={effectiveActive.participants}
                                        onlineUserIds={onlineUserIds}
                                        currentUserId={auth.user.id}
                                    />
                                </div>
                            </>
                        )}
                    </div>
                ) : (
                    <div className="text-muted-foreground hidden flex-1 items-center justify-center text-sm md:flex">
                        Select a chat to start messaging
                    </div>
                )}
            </div>
        </AppLayout>
    );
}
