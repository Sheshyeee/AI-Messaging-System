import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Bubble, BubbleContent } from '@/components/ui/bubble';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Marker, MarkerContent } from '@/components/ui/marker';
import { Message, MessageAvatar, MessageContent, MessageFooter } from '@/components/ui/message';
import {
    MessageScroller,
    MessageScrollerButton,
    MessageScrollerContent,
    MessageScrollerItem,
    MessageScrollerProvider,
    MessageScrollerViewport,
} from '@/components/ui/message-scroller';
import { router } from '@inertiajs/react';
import axios from 'axios';
import {
    ArrowLeft,
    File as FileIcon,
    FileText,
    Info,
    Mic,
    Paperclip,
    Phone,
    RotateCw,
    Send,
    Smile,
    SmilePlus,
    Sparkles,
    Trash2,
    Video,
    X,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type ChangeEventHandler, type FormEventHandler } from 'react';
import { createPortal } from 'react-dom';

export type AttachmentKind = 'image' | 'video' | 'audio' | 'pdf' | 'file';

export interface AttachmentItem {
    id: number;
    url: string;
    name: string;
    mime_type: string;
    size: number;
    kind: AttachmentKind;
}

export interface ReactionSummary {
    emoji: string;
    count: number;
    reacted_by_me: boolean;
    user_ids?: number[];
}

export interface MessageItem {
    id: number;
    body: string;
    from_me: boolean;
    timestamp: string;
    created_at: string;
    sender_id: number;
    sender_avatar_url?: string | null;
    sender_name: string | null;
    read_at: string | null;
    attachments: AttachmentItem[];
    reactions: ReactionSummary[];
}

interface ReadReceiptUser {
    id: number;
    name: string;
}

interface LocalAttachment {
    file: File;
    previewUrl: string; // blob: URL for images/video/audio, empty for other kinds
    kind: AttachmentKind;
}

interface PendingMessage {
    tempId: string;
    body: string;
    status: 'sending' | 'failed';
    created_at: string;
    attachments: LocalAttachment[];
}

const DIVIDER_GAP_MINUTES = 20;
const MAX_ATTACHMENTS = 10;
const MAX_ATTACHMENT_BYTES = 25 * 1024 * 1024; // keep in sync with server-side limit
const URL_PATTERN = /(https?:\/\/[^\s<]+[^\s<.,:;!?)'"\]])/g;
const IS_URL = /^https?:\/\//;
const QUICK_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '😡'];
const LONG_PRESS_MS = 450;
const PICKER_WIDTH = 232; // approx rendered width of the quick-reaction bar
const PICKER_HEIGHT = 44;

/**
 * Positions the reaction picker relative to the trigger button's actual
 * on-screen coordinates, clamped to the viewport. Used with a portal so the
 * picker is never clipped by an ancestor's overflow-hidden (e.g. the message
 * scroll container).
 */
function computePickerPosition(rect: DOMRect) {
    const margin = 8;

    let left = rect.left + rect.width / 2 - PICKER_WIDTH / 2;
    left = Math.min(Math.max(margin, left), window.innerWidth - PICKER_WIDTH - margin);

    const placeBelow = rect.top < PICKER_HEIGHT + margin * 2;
    const top = placeBelow ? rect.bottom + margin : rect.top - PICKER_HEIGHT - margin;

    return { top: top + window.scrollY, left: left + window.scrollX };
}

const EMOJI_CATEGORIES: { label: string; emojis: string[] }[] = [
    {
        label: 'Smileys',
        emojis: ['😀', '😁', '😂', '🤣', '😊', '😍', '😘', '😉', '😎', '🤔', '😴', '😭', '😢', '😡', '🥳', '😱', '🤗', '🙃', '🥰', '😅'],
    },
    {
        label: 'Gestures',
        emojis: ['👍', '👎', '👏', '🙌', '🙏', '👌', '✌️', '🤝', '💪', '👋', '🤙', '✋', '🤞', '👊'],
    },
    {
        label: 'Hearts',
        emojis: ['❤️', '🧡', '💛', '💚', '💙', '💜', '🖤', '🤍', '💔', '💕', '💖', '💯'],
    },
    {
        label: 'Other',
        emojis: ['🔥', '🎉', '✨', '⭐', '🎂', '🍕', '☕', '😷', '💤', '⚡', '👀', '💀'],
    },
];

function getInitials(name?: string | null) {
    if (!name || typeof name !== 'string') return '';
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function kindForFile(file: File): AttachmentKind {
    if (file.type.startsWith('image/')) return 'image';
    if (file.type.startsWith('video/')) return 'video';
    if (file.type.startsWith('audio/')) return 'audio';
    if (file.type === 'application/pdf') return 'pdf';
    return 'file';
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDuration(totalSeconds: number) {
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;
    return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function estimateMessageHeight(message: { body: string; attachments: { kind: AttachmentKind }[] }) {
    let height = 56; // baseline: avatar row + one-line bubble
    const hasGrid = message.attachments.some((a) => a.kind !== 'audio');
    const hasAudio = message.attachments.some((a) => a.kind === 'audio');
    if (hasGrid) height += 200;
    if (hasAudio) height += 48;
    if (message.body.length > 60) height += 24; // likely wraps
    return height;
}

function formatDivider(iso: string) {
    const date = new Date(iso);
    const now = new Date();
    const isToday = date.toDateString() === now.toDateString();

    const yesterday = new Date(now);
    yesterday.setDate(now.getDate() - 1);
    const isYesterday = date.toDateString() === yesterday.toDateString();

    const time = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    if (isToday) return `Today ${time}`;
    if (isYesterday) return `Yesterday ${time}`;

    const withinWeek = now.getTime() - date.getTime() < 6 * 24 * 60 * 60 * 1000;
    if (withinWeek) return `${date.toLocaleDateString(undefined, { weekday: 'long' })} ${time}`;

    return `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}`;
}

/** Renders plain text with bare URLs turned into clickable links. */
function Linkified({ text }: { text: string }) {
    if (!text) return null;

    const parts = text.split(URL_PATTERN);

    return (
        <>
            {parts.map((part, i) => {
                if (IS_URL.test(part)) {
                    return (
                        <a
                            key={i}
                            href={part}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="break-all underline underline-offset-2 hover:opacity-80"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {part}
                        </a>
                    );
                }
                return <span key={i}>{part}</span>;
            })}
        </>
    );
}

function FileChip({ name, size, url, downloadable = true }: { name: string; size: number; url: string; downloadable?: boolean }) {
    return (
        <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            download={downloadable ? name : undefined}
            className="bg-background/60 hover:bg-background/90 flex min-w-[180px] items-center gap-2 rounded-lg border px-3 py-2 transition-colors"
        >
            <FileText className="text-muted-foreground size-6 shrink-0" />
            <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-medium">{name}</span>
                <span className="text-muted-foreground text-[11px]">{formatBytes(size)}</span>
            </div>
        </a>
    );
}

function cnGrid(count: number) {
    if (count <= 1) return 'grid grid-cols-1 gap-1.5';
    return 'grid grid-cols-2 gap-1.5';
}

function VoiceMessagePlayer({ url }: { url: string }) {
    return (
        <div className="flex items-center gap-2 py-0.5">
            <audio src={url} controls preload="metadata" className="h-9 max-w-[240px]" />
        </div>
    );
}

/** Shared renderer for both confirmed attachments and local (pre-upload) previews. Audio is rendered separately as its own bubble. */
function AttachmentGrid({ attachments }: { attachments: { key: string; kind: AttachmentKind; url: string; name: string; size: number }[] }) {
    const gridAttachments = attachments.filter((a) => a.kind !== 'audio');
    if (gridAttachments.length === 0) return null;

    return (
        <div className={cnGrid(gridAttachments.length)}>
            {gridAttachments.map((a) => {
                if (a.kind === 'image') {
                    return (
                        <a key={a.key} href={a.url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-lg">
                            <img src={a.url} alt={a.name} className="max-h-72 w-full object-cover" />
                        </a>
                    );
                }
                if (a.kind === 'video') {
                    return (
                        <video key={a.key} src={a.url} controls className="max-h-72 w-full rounded-lg">
                            <track kind="captions" />
                        </video>
                    );
                }
                return <FileChip key={a.key} name={a.name} size={a.size} url={a.url} />;
            })}
        </div>
    );
}

function ReactionPicker({ onSelect }: { onSelect: (emoji: string) => void }) {
    return (
        <div className="bg-popover flex items-center gap-0.5 rounded-full border px-1.5 py-1 shadow-lg">
            {QUICK_REACTIONS.map((emoji) => (
                <button
                    key={emoji}
                    type="button"
                    onClick={() => onSelect(emoji)}
                    className="hover:bg-accent rounded-full p-1 text-lg leading-none transition-transform hover:scale-125"
                >
                    {emoji}
                </button>
            ))}
        </div>
    );
}

/** Compact badge meant to overlap the bottom corner of a message bubble, Messenger-style. */
function ReactionPills({ reactions, fromMe, onToggle }: { reactions: ReactionSummary[]; fromMe: boolean; onToggle: (emoji: string) => void }) {
    if (reactions.length === 0) return null;

    return (
        <div
            className={`bg-background border-border absolute -bottom-2.5 z-[1] flex items-center gap-0.5 rounded-full border px-1 py-0.5 shadow-sm ${
                fromMe ? '-left-1' : '-right-1'
            }`}
        >
            {reactions.map((r) => (
                <button
                    key={r.emoji}
                    type="button"
                    onClick={() => onToggle(r.emoji)}
                    className={
                        r.reacted_by_me
                            ? 'bg-primary/10 flex items-center gap-0.5 rounded-full px-1 text-xs'
                            : 'flex items-center gap-0.5 rounded-full px-1 text-xs'
                    }
                >
                    <span className="text-sm leading-none">{r.emoji}</span>
                    {r.count > 1 && <span className="text-muted-foreground text-[10px]">{r.count}</span>}
                </button>
            ))}
        </div>
    );
}

/**
 * Trigger that opens the quick-reaction picker for a message. Hidden by
 * default: revealed on hover (desktop, via the `group` on MessageContent) or
 * while `active` is true (long-press on touch, or the picker is currently
 * open for this message) — never shown for every message at once.
 */
function ReactMessageButton({
    fromMe,
    active,
    onClick,
}: {
    fromMe: boolean;
    active: boolean;
    onClick: (e: React.MouseEvent<HTMLButtonElement>) => void;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            aria-label="React to message"
            className={`hover:bg-accent flex shrink-0 items-center justify-center self-end overflow-hidden rounded-full transition-all duration-150 ${
                fromMe ? 'order-first' : 'order-last'
            } ${
                active
                    ? 'size-7 opacity-100'
                    : 'pointer-events-none size-0 opacity-0 group-hover:pointer-events-auto group-hover:size-7 group-hover:opacity-100'
            }`}
        >
            <SmilePlus className="text-muted-foreground size-4 shrink-0" />
        </button>
    );
}

type TimelineEntry =
    | { kind: 'divider'; key: string; label: string }
    | { kind: 'real'; message: MessageItem; showAvatar: boolean }
    | { kind: 'pending'; message: PendingMessage; showAvatar: boolean };

type RawEntry =
    | { kind: 'real'; message: MessageItem; at: number; senderId: number }
    | { kind: 'pending'; message: PendingMessage; at: number; senderId: number };

function buildTimeline(messages: MessageItem[], pending: PendingMessage[], currentUserId: number): TimelineEntry[] {
    const combined: RawEntry[] = [
        ...messages.map((m) => ({
            kind: 'real' as const,
            message: m,
            at: new Date(m.created_at).getTime(),
            senderId: m.sender_id,
        })),
        ...pending.map((m) => ({
            kind: 'pending' as const,
            message: m,
            at: new Date(m.created_at).getTime(),
            senderId: currentUserId,
        })),
    ].sort((a, b) => a.at - b.at);

    type WithDividers = RawEntry | { kind: 'divider'; key: string; label: string };
    const withDividers: WithDividers[] = [];
    let lastShownAt: number | null = null;

    for (const entry of combined) {
        const gapMinutes = lastShownAt === null ? Infinity : (entry.at - lastShownAt) / 60000;

        if (gapMinutes >= DIVIDER_GAP_MINUTES) {
            withDividers.push({ kind: 'divider', key: `divider-${entry.at}`, label: formatDivider(entry.message.created_at) });
            lastShownAt = entry.at;
        }

        withDividers.push(entry);
    }

    const timeline: TimelineEntry[] = [];

    for (let i = 0; i < withDividers.length; i++) {
        const item = withDividers[i];

        if (item.kind === 'divider') {
            timeline.push(item);
            continue;
        }

        const next = withDividers[i + 1];
        const showAvatar = next === undefined || next.kind === 'divider' || next.senderId !== item.senderId;

        timeline.push(
            item.kind === 'real' ? { kind: 'real', message: item.message, showAvatar } : { kind: 'pending', message: item.message, showAvatar },
        );
    }

    return timeline;
}

function reactionsSignature(reactions: ReactionSummary[]) {
    return reactions.map((r) => `${r.emoji}${r.count}${r.reacted_by_me ? '1' : '0'}`).join('');
}

function messagesSignature(messages: MessageItem[]) {
    return normalizeMessages(messages)
        .map((m) => `${m.id}:${m.sender_id}:${m.sender_name ?? ''}:${m.created_at}:${m.read_at ?? ''}:${reactionsSignature(m.reactions)}`)
        .join(',');
}

function normalizeMessages(messages: MessageItem[]) {
    const byId = new Map<number, MessageItem>();
    for (const message of messages) {
        byId.set(message.id, message);
    }

    return Array.from(byId.values()).sort((a, b) => {
        const aTime = new Date(a.created_at).getTime();
        const bTime = new Date(b.created_at).getTime();

        if (aTime !== bTime) return aTime - bTime;
        return a.id - b.id;
    });
}

interface MessageThreadProps {
    conversationId: number;
    chatName: string;
    messages: MessageItem[];
    onToggleInfo?: () => void;
    onBack?: () => void;
    currentUserId: number;
    currentUserName: string;
    isOnline: boolean;
    isGroup?: boolean;
    participantCount?: number;
    avatarUrl?: string | null;
    currentUserAvatarUrl?: string | null;
}

export function MessageThread({
    conversationId,
    chatName,
    messages,
    avatarUrl,
    currentUserAvatarUrl,
    onToggleInfo,
    onBack,
    currentUserId,
    currentUserName,
    isOnline,
    isGroup = false,
    participantCount,
}: MessageThreadProps) {
    const [draft, setDraft] = useState('');
    const [selected, setSelected] = useState<LocalAttachment[]>([]);
    const [attachError, setAttachError] = useState<string | null>(null);
    const [pending, setPending] = useState<PendingMessage[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [displayMessages, setDisplayMessages] = useState(() => normalizeMessages(messages));
    const signatureRef = useRef(messagesSignature(normalizeMessages(messages)));
    const [readReceiptUsers, setReadReceiptUsers] = useState<ReadReceiptUser[]>([]);

    const [showEmojiPicker, setShowEmojiPicker] = useState(false);
    const emojiPickerRef = useRef<HTMLDivElement>(null);
    const emojiButtonRef = useRef<HTMLButtonElement>(null);
    const [smartReplies, setSmartReplies] = useState<string[]>([]);
    const smartRepliesFetchedFor = useRef<number | null>(null);
    const [smartRepliesLoading, setSmartRepliesLoading] = useState(false);

    const [openReactionPickerId, setOpenReactionPickerId] = useState<number | null>(null);
    const [pickerAnchor, setPickerAnchor] = useState<{ top: number; left: number } | null>(null);
    const reactionPickerRef = useRef<HTMLDivElement>(null);

    // Tracks which message's react button is currently revealed via long-press
    // on touch devices (desktop reveals via CSS :hover instead).
    const [revealedMessageId, setRevealedMessageId] = useState<number | null>(null);
    const longPressTimerRef = useRef<number | null>(null);

    // Voice-message recording state.
    const [isRecording, setIsRecording] = useState(false);
    const [recordingSeconds, setRecordingSeconds] = useState(0);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const recordingTimerRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);

    useEffect(() => {
        const normalized = normalizeMessages(messages);
        const signature = messagesSignature(normalized);
        if (signature !== signatureRef.current) {
            signatureRef.current = signature;
            setDisplayMessages(normalized);
        }
    }, [messages]);

    useEffect(() => {
        const last = displayMessages[displayMessages.length - 1];

        if (!last || last.from_me || smartRepliesFetchedFor.current === last.id) {
            if (last?.from_me) setSmartReplies([]);
            return;
        }

        smartRepliesFetchedFor.current = last.id;
        setSmartRepliesLoading(true);

        axios
            .get(route('chats.smartReplies', conversationId))
            .then(({ data }) => setSmartReplies(data.suggestions ?? []))
            .catch((err) => {
                console.error('smart replies failed', err);
                setSmartReplies([]);
            })
            .finally(() => setSmartRepliesLoading(false));
    }, [displayMessages, conversationId]);

    useEffect(() => {
        if (openReactionPickerId === null) return;

        const handleClick = (e: MouseEvent) => {
            if (reactionPickerRef.current?.contains(e.target as Node)) return;
            setOpenReactionPickerId(null);
            setPickerAnchor(null);
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [openReactionPickerId]);

    // Long-press reveal: hide the button again on any tap outside the row it
    // belongs to (rows are marked with data-reaction-row / data-message-id).
    useEffect(() => {
        if (revealedMessageId === null) return;

        const handleOutside = (e: Event) => {
            const target = e.target as HTMLElement;
            const row = target.closest('[data-reaction-row]');
            const rowId = row?.getAttribute('data-message-id');
            if (rowId !== String(revealedMessageId)) {
                setRevealedMessageId(null);
            }
        };

        document.addEventListener('touchstart', handleOutside);
        document.addEventListener('mousedown', handleOutside);
        return () => {
            document.removeEventListener('touchstart', handleOutside);
            document.removeEventListener('mousedown', handleOutside);
        };
    }, [revealedMessageId]);

    // Revoke blob URLs for local previews once they're no longer needed.
    useEffect(() => {
        return () => {
            selected.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (!showEmojiPicker) return;

        const handleClick = (e: MouseEvent) => {
            const target = e.target as Node;
            if (emojiPickerRef.current?.contains(target)) return;
            if (emojiButtonRef.current?.contains(target)) return;
            setShowEmojiPicker(false);
        };

        document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showEmojiPicker]);

    // Safety net: stop the mic stream / timer if the component unmounts mid-recording.
    useEffect(() => {
        return () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            if (recordingTimerRef.current !== null) window.clearInterval(recordingTimerRef.current);
        };
    }, []);

    const timeline = useMemo(() => buildTimeline(displayMessages, pending, currentUserId), [displayMessages, pending, currentUserId]);

    const lastSeenMessageId = useMemo(() => {
        let last: MessageItem | null = null;
        for (const m of displayMessages) {
            if (!m.from_me || !m.read_at) continue;
            if (!last || new Date(m.created_at).getTime() > new Date(last.created_at).getTime()) {
                last = m;
            }
        }
        return last?.id ?? null;
    }, [displayMessages]);

    useEffect(() => {
        const channel = window.Echo.private(`conversation.${conversationId}`);

        channel.listen('.MessageSent', (e: { message: MessageItem & { reactions: Array<ReactionSummary & { user_ids?: number[] }> } }) => {
            const incoming: MessageItem = {
                ...e.message,
                from_me: e.message.sender_id === currentUserId,
                reactions: e.message.reactions.map((r) => ({
                    emoji: r.emoji,
                    count: r.count,
                    reacted_by_me: (r.user_ids?.includes(currentUserId) ?? r.reacted_by_me) as boolean,
                })),
            };

            // Our own messages are already shown via the optimistic pending
            // bubble and reconciled through sendMessage()'s onSuccess. If we
            // also receive our own broadcast (e.g. toOthers() couldn't exclude
            // this socket), skip it to avoid a duplicate.
            if (incoming.from_me) return;

            setDisplayMessages((prev) => {
                const next = normalizeMessages([...prev, incoming]);
                if (messagesSignature(next) === messagesSignature(prev)) return prev;
                signatureRef.current = messagesSignature(next);
                return next;
            });

            router.reload({ only: ['conversations'] });
        });

        channel.listen('.ReactionUpdated', (e: { message_id: number; reactions: { emoji: string; count: number; user_ids: number[] }[] }) => {
            setDisplayMessages((prev) => {
                const next = prev.map((m) =>
                    m.id === e.message_id
                        ? {
                              ...m,
                              reactions: e.reactions.map((r) => ({
                                  emoji: r.emoji,
                                  count: r.count,
                                  reacted_by_me: r.user_ids.includes(currentUserId),
                              })),
                          }
                        : m,
                );
                signatureRef.current = messagesSignature(next);
                return next;
            });
        });

        channel.listen('.MessagesRead', (e: { reader_id: number; reader_name: string; read_at: string }) => {
            if (e.reader_id === currentUserId) return; // I read it; not relevant here

            setReadReceiptUsers((prev) => {
                if (prev.some((user) => user.id === e.reader_id)) return prev;
                return [...prev, { id: e.reader_id, name: e.reader_name }];
            });

            setDisplayMessages((prev) => {
                const next = prev.map((m) => (m.from_me && !m.read_at ? { ...m, read_at: e.read_at } : m));
                signatureRef.current = messagesSignature(next);
                return next;
            });
        });

        return () => {
            window.Echo.leave(`conversation.${conversationId}`);
        };
    }, [conversationId, currentUserId]);

    const handleFileSelect: ChangeEventHandler<HTMLInputElement> = (e) => {
        const files = Array.from(e.target.files ?? []);
        e.target.value = ''; // allow re-selecting the same file later
        if (files.length === 0) return;

        setAttachError(null);

        const oversized = files.find((f) => f.size > MAX_ATTACHMENT_BYTES);
        if (oversized) {
            setAttachError(`"${oversized.name}" is over the 25MB limit.`);
            return;
        }

        setSelected((prev) => {
            const room = MAX_ATTACHMENTS - prev.length;
            if (room <= 0) {
                setAttachError(`You can attach up to ${MAX_ATTACHMENTS} files per message.`);
                return prev;
            }
            const toAdd = files.slice(0, room).map((file) => {
                const kind = kindForFile(file);
                return {
                    file,
                    kind,
                    previewUrl: kind === 'image' || kind === 'video' || kind === 'audio' ? URL.createObjectURL(file) : '',
                };
            });
            return [...prev, ...toAdd];
        });
    };

    const removeSelected = (index: number) => {
        setSelected((prev) => {
            const target = prev[index];
            if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
            return prev.filter((_, i) => i !== index);
        });
    };

    const sendMessage = (body: string, tempId: string, attachments: LocalAttachment[]) => {
        const formData = new FormData();
        formData.append('body', body);
        attachments.forEach((a) => formData.append('attachments[]', a.file));

        router.post(route('chats.send', conversationId), formData, {
            forceFormData: true,
            preserveScroll: true,
            preserveState: true,
            only: ['messages', 'conversations'],
            onSuccess: () => {
                attachments.forEach((a) => a.previewUrl && URL.revokeObjectURL(a.previewUrl));
                setPending((prev) => prev.filter((m) => m.tempId !== tempId));
            },
            onError: () => {
                setPending((prev) => prev.map((m) => (m.tempId === tempId ? { ...m, status: 'failed' } : m)));
            },
        });
    };

    const handleSend: FormEventHandler = (e) => {
        e.preventDefault();
        const body = draft.trim();
        if (!body && selected.length === 0) return;

        const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        const attachments = selected;

        setPending((prev) => [...prev, { tempId, body, status: 'sending', created_at: new Date().toISOString(), attachments }]);
        setDraft('');
        setSelected([]);
        setAttachError(null);
        setSmartReplies([]); // ADD THIS LINE
        setSmartRepliesLoading(false);
        sendMessage(body, tempId, attachments);
    };
    const pickSuggestion = (text: string) => {
        setSmartReplies([]);
        setDraft(text);
    };
    const retry = (message: PendingMessage) => {
        setPending((prev) => prev.map((m) => (m.tempId === message.tempId ? { ...m, status: 'sending' } : m)));
        sendMessage(message.body, message.tempId, message.attachments);
    };

    const insertEmoji = (emoji: string) => {
        setDraft((prev) => prev + emoji);
    };

    const startLongPress = (messageId: number) => {
        if (longPressTimerRef.current !== null) window.clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = window.setTimeout(() => {
            setRevealedMessageId(messageId);
            longPressTimerRef.current = null;
        }, LONG_PRESS_MS);
    };

    const clearLongPress = () => {
        if (longPressTimerRef.current !== null) {
            window.clearTimeout(longPressTimerRef.current);
            longPressTimerRef.current = null;
        }
    };

    const openReactionPicker = (e: React.MouseEvent<HTMLButtonElement>, messageId: number) => {
        const rect = e.currentTarget.getBoundingClientRect();
        setPickerAnchor(computePickerPosition(rect));
        setOpenReactionPickerId((prev) => (prev === messageId ? null : messageId));
    };

    const toggleReaction = (messageId: number, emoji: string) => {
        setOpenReactionPickerId(null);
        setPickerAnchor(null);
        setRevealedMessageId(null);

        setDisplayMessages((prev) =>
            prev.map((m) => {
                if (m.id !== messageId) return m;

                const existing = m.reactions.find((r) => r.emoji === emoji);
                const reactedByMe = existing ? existing.reacted_by_me : false;

                let nextReactions: ReactionSummary[];
                if (existing) {
                    nextReactions = m.reactions
                        .map((r) => (r.emoji === emoji ? { ...r, count: r.count - 1, reacted_by_me: false } : r))
                        .filter((r) => r.count > 0);
                } else {
                    nextReactions = [...m.reactions, { emoji, count: 1, reacted_by_me: true }];
                }

                return {
                    ...m,
                    reactions: nextReactions,
                };
            }),
        );

        router.post(
            route('messages.react', { conversation: conversationId, message: messageId }),
            { emoji },
            { preserveScroll: true, preserveState: true, only: ['messages', 'conversations'] },
        );
    };

    const startRecording = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            streamRef.current = stream;

            const recorder = new MediaRecorder(stream);
            audioChunksRef.current = [];
            recorder.ondataavailable = (e) => {
                if (e.data.size > 0) audioChunksRef.current.push(e.data);
            };
            recorder.start();
            mediaRecorderRef.current = recorder;

            setIsRecording(true);
            setRecordingSeconds(0);
            recordingTimerRef.current = window.setInterval(() => setRecordingSeconds((s) => s + 1), 1000);
        } catch {
            setAttachError('Microphone access was denied or unavailable.');
        }
    };

    const stopRecording = (shouldSend: boolean) => {
        const recorder = mediaRecorderRef.current;
        if (!recorder) return;

        recorder.onstop = () => {
            streamRef.current?.getTracks().forEach((t) => t.stop());
            streamRef.current = null;

            if (shouldSend && audioChunksRef.current.length > 0) {
                const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
                const file = new File([blob], `voice-message-${Date.now()}.webm`, { type: 'audio/webm' });
                const attachment: LocalAttachment = { file, kind: 'audio', previewUrl: URL.createObjectURL(blob) };

                const tempId = `temp-${Date.now()}-${Math.random().toString(36).slice(2)}`;
                setPending((prev) => [
                    ...prev,
                    { tempId, body: '', status: 'sending', created_at: new Date().toISOString(), attachments: [attachment] },
                ]);
                sendMessage('', tempId, [attachment]);
            }

            audioChunksRef.current = [];
        };

        recorder.stop();
        mediaRecorderRef.current = null;

        if (recordingTimerRef.current !== null) {
            window.clearInterval(recordingTimerRef.current);
            recordingTimerRef.current = null;
        }

        setIsRecording(false);
        setRecordingSeconds(0);
    };

    const cancelRecording = () => stopRecording(false);
    const finishRecording = () => stopRecording(true);

    return (
        <div className="flex h-full flex-1 flex-col">
            {/* Thread header */}
            <div className="border-sidebar-border/70 dark:border-sidebar-border flex items-center justify-between border-b px-4 py-3 md:px-4">
                <div className="flex min-w-0 items-center gap-3">
                    {onBack && (
                        <Button
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-full md:hidden"
                            aria-label="Back to conversations"
                            onClick={onBack}
                        >
                            <ArrowLeft className="size-5" />
                        </Button>
                    )}
                    <div className="relative shrink-0">
                        <Avatar>
                            {avatarUrl ? <AvatarImage src={avatarUrl} alt={chatName} /> : <AvatarFallback>{getInitials(chatName)}</AvatarFallback>}
                        </Avatar>
                        {isOnline && <span className="border-background absolute right-0 bottom-0 size-2.5 rounded-full border-2 bg-green-500" />}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium">{chatName}</span>
                        <span className="text-muted-foreground text-xs">
                            {isGroup
                                ? participantCount && participantCount > 0
                                    ? `${participantCount} members${isOnline ? ' · Active now' : ''}`
                                    : isOnline
                                      ? 'Active now'
                                      : 'Offline'
                                : isOnline
                                  ? 'Active now'
                                  : 'Offline'}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-0.5 sm:gap-1">
                    <Button variant="ghost" size="icon" className="hidden rounded-full sm:flex" aria-label="Call">
                        <Phone className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="hidden rounded-full sm:flex" aria-label="Video call">
                        <Video className="size-4" />
                    </Button>
                    <Button variant="ghost" size="icon" className="rounded-full" aria-label="Conversation info" onClick={onToggleInfo}>
                        <Info className="size-4" />
                    </Button>
                </div>
            </div>

            {/* Messages */}
            <MessageScrollerProvider autoScroll defaultScrollPosition="end">
                <MessageScroller className="scrollbar-thin flex-1 px-4 py-4">
                    <MessageScrollerViewport>
                        <MessageScrollerContent>
                            {timeline.map((entry, index) => {
                                if (entry.kind === 'divider') {
                                    return (
                                        <MessageScrollerItem key={entry.key}>
                                            <Marker className="flex w-full justify-center">
                                                <MarkerContent className="text-muted-foreground text-center text-xs">{entry.label}</MarkerContent>
                                            </Marker>
                                        </MessageScrollerItem>
                                    );
                                }

                                const isLast = index === timeline.length - 1;

                                if (entry.kind === 'real') {
                                    const message = entry.message;
                                    const isSeenMarker = message.from_me && message.id === lastSeenMessageId;
                                    const hasAttachments = message.attachments.length > 0;
                                    const senderName = message.from_me ? currentUserName : (message.sender_name ?? chatName);

                                    return (
                                        <MessageScrollerItem
                                            key={message.id}
                                            messageId={String(message.id)}
                                            scrollAnchor={isLast}
                                            estimatedHeight={estimateMessageHeight(message)}
                                        >
                                            <Message align={message.from_me ? 'end' : 'start'}>
                                                {!message.from_me && (
                                                    <MessageAvatar className={entry.showAvatar ? '' : 'invisible'}>
                                                        <Avatar>
                                                            {message.sender_avatar_url ? (
                                                                <AvatarImage src={message.sender_avatar_url} alt={senderName} />
                                                            ) : (
                                                                <AvatarFallback>{getInitials(senderName)}</AvatarFallback>
                                                            )}
                                                        </Avatar>
                                                    </MessageAvatar>
                                                )}
                                                <MessageContent className="group relative min-w-0">
                                                    {Boolean(isGroup) && !message.from_me && (
                                                        <div className="text-muted-foreground mb-1 text-[11px] font-medium">{senderName}</div>
                                                    )}
                                                    {/* Bubble + react trigger sit side by side, in normal flow. The
                                                        trigger stays hidden until this row is hovered (desktop) or
                                                        long-pressed (touch) — never shown for every message at once. */}
                                                    <div
                                                        data-reaction-row
                                                        data-message-id={message.id}
                                                        className={`flex w-full min-w-0 items-end gap-1 ${message.from_me ? 'flex-row-reverse' : 'flex-row'}`}
                                                        onTouchStart={() => startLongPress(message.id)}
                                                        onTouchEnd={clearLongPress}
                                                        onTouchMove={clearLongPress}
                                                        onTouchCancel={clearLongPress}
                                                    >
                                                        <div
                                                            className={`relative flex max-w-[80%] min-w-fit flex-col gap-1.5 ${
                                                                message.from_me ? 'items-end' : 'items-start'
                                                            } ${message.reactions.length > 0 ? 'mb-2.5' : ''}`}
                                                        >
                                                            {hasAttachments && (
                                                                <AttachmentGrid
                                                                    attachments={message.attachments.map((a) => ({
                                                                        key: String(a.id),
                                                                        kind: a.kind,
                                                                        url: a.url,
                                                                        name: a.name,
                                                                        size: a.size,
                                                                    }))}
                                                                />
                                                            )}
                                                            {message.attachments
                                                                .filter((a) => a.kind === 'audio')
                                                                .map((a) => (
                                                                    <Bubble key={a.id} variant={message.from_me ? 'default' : 'muted'}>
                                                                        <BubbleContent className="px-2 py-1.5">
                                                                            <VoiceMessagePlayer url={a.url} />
                                                                        </BubbleContent>
                                                                    </Bubble>
                                                                ))}
                                                            {message.body && (
                                                                <Bubble variant={message.from_me ? 'default' : 'muted'}>
                                                                    <BubbleContent className="whitespace-pre-wrap">
                                                                        <Linkified text={message.body} />
                                                                    </BubbleContent>
                                                                </Bubble>
                                                            )}

                                                            <ReactionPills
                                                                reactions={message.reactions}
                                                                fromMe={message.from_me}
                                                                onToggle={(emoji) => toggleReaction(message.id, emoji)}
                                                            />
                                                        </div>

                                                        <ReactMessageButton
                                                            fromMe={message.from_me}
                                                            active={revealedMessageId === message.id || openReactionPickerId === message.id}
                                                            onClick={(e) => openReactionPicker(e, message.id)}
                                                        />
                                                    </div>
                                                    {openReactionPickerId === message.id &&
                                                        pickerAnchor &&
                                                        createPortal(
                                                            <div
                                                                ref={reactionPickerRef}
                                                                style={{
                                                                    position: 'absolute',
                                                                    top: pickerAnchor.top,
                                                                    left: pickerAnchor.left,
                                                                    zIndex: 50,
                                                                }}
                                                            >
                                                                <ReactionPicker onSelect={(emoji) => toggleReaction(message.id, emoji)} />
                                                            </div>,
                                                            document.body,
                                                        )}
                                                    {isSeenMarker ? (
                                                        <MessageFooter className="flex items-center gap-1">
                                                            {readReceiptUsers.map((reader) => (
                                                                <Avatar key={reader.id} className="size-4">
                                                                    <AvatarFallback className="text-[8px]">{getInitials(reader.name)}</AvatarFallback>
                                                                </Avatar>
                                                            ))}
                                                        </MessageFooter>
                                                    ) : (
                                                        message.from_me && isLast && <MessageFooter>Sent</MessageFooter>
                                                    )}
                                                </MessageContent>
                                            </Message>
                                        </MessageScrollerItem>
                                    );
                                }

                                const message = entry.message;
                                const hasAttachments = message.attachments.length > 0;
                                return (
                                    <MessageScrollerItem key={message.tempId} messageId={message.tempId} scrollAnchor={isLast}>
                                        <Message align="end">
                                            <MessageContent className="min-w-0">
                                                <div
                                                    className={`flex max-w-[80%] min-w-fit flex-col items-end gap-1.5 ${
                                                        message.status === 'failed' ? 'opacity-50' : 'opacity-70'
                                                    }`}
                                                >
                                                    {hasAttachments && (
                                                        <AttachmentGrid
                                                            attachments={message.attachments.map((a, i) => ({
                                                                key: `${message.tempId}-${i}`,
                                                                kind: a.kind,
                                                                url: a.previewUrl || '#',
                                                                name: a.file.name,
                                                                size: a.file.size,
                                                            }))}
                                                        />
                                                    )}
                                                    {message.attachments
                                                        .filter((a) => a.kind === 'audio')
                                                        .map((a, i) => (
                                                            <Bubble key={`${message.tempId}-audio-${i}`} variant="default">
                                                                <BubbleContent className="px-2 py-1.5">
                                                                    <VoiceMessagePlayer url={a.previewUrl} />
                                                                </BubbleContent>
                                                            </Bubble>
                                                        ))}
                                                    {message.body && (
                                                        <Bubble variant="default">
                                                            <BubbleContent className="whitespace-pre-wrap">{message.body}</BubbleContent>
                                                        </Bubble>
                                                    )}
                                                </div>
                                                {message.status === 'failed' ? (
                                                    <MessageFooter>
                                                        <button
                                                            type="button"
                                                            onClick={() => retry(message)}
                                                            className="text-destructive inline-flex items-center gap-1 hover:underline"
                                                        >
                                                            <RotateCw className="size-3" />
                                                            Failed — tap to retry
                                                        </button>
                                                    </MessageFooter>
                                                ) : (
                                                    isLast && <MessageFooter>Sending…</MessageFooter>
                                                )}
                                            </MessageContent>
                                        </Message>
                                    </MessageScrollerItem>
                                );
                            })}
                        </MessageScrollerContent>
                    </MessageScrollerViewport>
                    <MessageScrollerButton direction="end" />
                </MessageScroller>
            </MessageScrollerProvider>
            {(smartRepliesLoading || smartReplies.length > 0) && !draft.trim() && (
                <div className="border-sidebar-border/70 dark:border-sidebar-border flex items-center gap-2 overflow-x-auto border-t px-4 pt-3">
                    <Sparkles className={`text-muted-foreground size-3.5 shrink-0 ${smartRepliesLoading ? 'animate-pulse' : ''}`} />
                    {smartRepliesLoading ? (
                        <div className="flex items-center gap-2">
                            {[0, 1, 2].map((i) => (
                                <span
                                    key={i}
                                    className="border-border bg-muted/60 h-6 shrink-0 animate-pulse rounded-full border"
                                    style={{ width: 64 + i * 18, animationDelay: `${i * 120}ms` }}
                                />
                            ))}
                        </div>
                    ) : (
                        smartReplies.map((text, i) => (
                            <button
                                key={i}
                                type="button"
                                onClick={() => pickSuggestion(text)}
                                className="border-border hover:bg-accent shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-normal transition-colors"
                            >
                                {text}
                            </button>
                        ))
                    )}
                </div>
            )}
            {/* Selected-file preview strip */}
            {selected.length > 0 && (
                <div className="border-sidebar-border/70 dark:border-sidebar-border flex flex-wrap gap-2 border-t px-4 pt-3">
                    {selected.map((a, i) => (
                        <div key={i} className="relative">
                            {a.kind === 'image' ? (
                                <img src={a.previewUrl} alt={a.file.name} className="size-16 rounded-lg object-cover" />
                            ) : a.kind === 'video' ? (
                                <div className="bg-muted flex size-16 items-center justify-center rounded-lg">
                                    <Video className="text-muted-foreground size-6" />
                                </div>
                            ) : a.kind === 'audio' ? (
                                <div className="bg-muted flex size-16 flex-col items-center justify-center rounded-lg px-1">
                                    <Mic className="text-muted-foreground size-5" />
                                    <span className="text-muted-foreground w-full truncate text-center text-[9px]">{a.file.name}</span>
                                </div>
                            ) : (
                                <div className="bg-muted flex size-16 flex-col items-center justify-center rounded-lg px-1">
                                    {a.kind === 'pdf' ? (
                                        <FileText className="text-muted-foreground size-5" />
                                    ) : (
                                        <FileIcon className="text-muted-foreground size-5" />
                                    )}
                                    <span className="text-muted-foreground w-full truncate text-center text-[9px]">{a.file.name}</span>
                                </div>
                            )}
                            <button
                                type="button"
                                onClick={() => removeSelected(i)}
                                className="bg-foreground text-background absolute -top-1.5 -right-1.5 flex size-5 items-center justify-center rounded-full"
                                aria-label="Remove attachment"
                            >
                                <X className="size-3" />
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {attachError && <p className="text-destructive px-4 pt-2 text-xs">{attachError}</p>}

            {/* Composer */}
            <div className="border-sidebar-border/70 dark:border-sidebar-border relative border-t px-4 py-3">
                {showEmojiPicker && (
                    <div ref={emojiPickerRef} className="bg-popover absolute bottom-full left-4 z-20 mb-2 w-72 rounded-xl border p-3 shadow-lg">
                        <div className="max-h-56 space-y-3 overflow-y-auto">
                            {EMOJI_CATEGORIES.map((category) => (
                                <div key={category.label}>
                                    <p className="text-muted-foreground mb-1 text-xs font-medium">{category.label}</p>
                                    <div className="grid grid-cols-8 gap-1">
                                        {category.emojis.map((emoji) => (
                                            <button
                                                key={emoji}
                                                type="button"
                                                onClick={() => insertEmoji(emoji)}
                                                className="hover:bg-accent rounded-md p-1 text-lg leading-none"
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {isRecording ? (
                    <div className="flex items-center gap-3 px-1">
                        <button
                            type="button"
                            onClick={cancelRecording}
                            className="text-destructive hover:bg-accent flex size-9 shrink-0 items-center justify-center rounded-full transition-colors"
                            aria-label="Cancel recording"
                        >
                            <Trash2 className="size-4" />
                        </button>
                        <div className="flex flex-1 items-center gap-2">
                            <span className="size-2.5 shrink-0 animate-pulse rounded-full bg-red-500" />
                            <span className="text-sm font-medium tabular-nums">{formatDuration(recordingSeconds)}</span>
                            <span className="text-muted-foreground text-xs">Recording…</span>
                        </div>
                        <Button type="button" size="icon" className="shrink-0 rounded-full" onClick={finishRecording} aria-label="Send voice message">
                            <Send className="size-4" />
                        </Button>
                    </div>
                ) : (
                    <form onSubmit={handleSend} className="flex items-center gap-1.5 sm:gap-2">
                        <input
                            ref={fileInputRef}
                            type="file"
                            multiple
                            accept="image/*,video/*,audio/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip,.txt,.csv"
                            onChange={handleFileSelect}
                            className="hidden"
                        />
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-full"
                            aria-label="Attach file"
                            onClick={() => fileInputRef.current?.click()}
                        >
                            <Paperclip className="size-4" />
                        </Button>
                        <Button
                            ref={emojiButtonRef}
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="shrink-0 rounded-full"
                            aria-label="Choose emoji"
                            onClick={() => setShowEmojiPicker((v) => !v)}
                        >
                            <Smile className="size-4" />
                        </Button>
                        <Input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Aa" className="bg-muted flex-1 rounded-full" />
                        {!draft.trim() && selected.length === 0 ? (
                            <Button
                                type="button"
                                size="icon"
                                className="shrink-0 rounded-full"
                                onClick={startRecording}
                                aria-label="Record voice message"
                            >
                                <Mic className="size-4" />
                            </Button>
                        ) : (
                            <Button type="submit" size="icon" className="shrink-0 rounded-full" aria-label="Send message">
                                <Send className="size-4" />
                            </Button>
                        )}
                    </form>
                )}
            </div>
        </div>
    );
}
