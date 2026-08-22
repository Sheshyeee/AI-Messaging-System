import type { AttachmentItem, MessageItem } from '@/components/message-thread';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { router } from '@inertiajs/react';
import { Camera, File as FileIcon, FileText, Image as ImageIcon, ImageOff, Inbox, Play, Users, X } from 'lucide-react';
import type { ChangeEvent } from 'react';
import { useMemo } from 'react';

function getInitials(name: string) {
    return name
        .split(' ')
        .map((part) => part[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

function formatBytes(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export interface ConversationParticipant {
    id: number;
    name: string;
    avatar?: string | null;
}

interface ConversationInfoPanelProps {
    conversationId: number;
    chatName: string;
    avatarUrl?: string | null;
    messages: MessageItem[];
    onClose: () => void;
    isFriendOnline: boolean;
    isGroup?: boolean;
    participants?: ConversationParticipant[];
    onlineUserIds?: Set<number>;
    currentUserId: number;
}

function SectionHeading({ icon: Icon, label, count }: { icon: React.ElementType; label: string; count: number }) {
    return (
        <div className="mb-3 flex items-center justify-between">
            <h3 className="text-muted-foreground flex items-center gap-1.5 text-xs font-semibold tracking-wide uppercase">
                <Icon className="size-3.5" />
                {label}
            </h3>
            {count > 0 && (
                <span className="bg-muted text-muted-foreground rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums">{count}</span>
            )}
        </div>
    );
}

function EmptyState({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
    return (
        <div className="border-sidebar-border/70 dark:border-sidebar-border flex flex-col items-center gap-2 rounded-xl border border-dashed py-7 text-center">
            <Icon className="text-muted-foreground/50 size-5" />
            <p className="text-muted-foreground text-xs">{label}</p>
        </div>
    );
}

export function ConversationInfoPanel({
    conversationId,
    chatName,
    avatarUrl,
    messages,
    onClose,
    isFriendOnline,
    isGroup = false,
    participants = [],
    onlineUserIds,
    currentUserId,
}: ConversationInfoPanelProps) {
    const { media, files } = useMemo(() => {
        const all: AttachmentItem[] = messages.flatMap((m) => m.attachments);
        return {
            media: all.filter((a) => a.kind === 'image' || a.kind === 'video'),
            files: all.filter((a) => a.kind === 'pdf' || a.kind === 'file'),
        };
    }, [messages]);

    const onlineCount = isGroup && onlineUserIds ? participants.filter((p) => p.id !== currentUserId && onlineUserIds.has(p.id)).length : 0;

    const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('avatar', file);

        router.post(route('chats.avatar', conversationId), formData, {
            preserveScroll: true,
            preserveState: true,
        });
    };

    return (
        <aside className="border-sidebar-border/70 dark:border-sidebar-border bg-background flex h-full w-full flex-col border-l">
            {/* Header */}
            <div className="border-sidebar-border/70 dark:border-sidebar-border flex shrink-0 items-center justify-between border-b px-4 py-3.5">
                <h2 className="text-sm font-semibold">Conversation info</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    className="size-8 rounded-full"
                    aria-label="Close conversation info"
                    onClick={onClose}
                >
                    <X className="size-4" />
                </Button>
            </div>

            <div className="flex-1 overflow-y-auto">
                {/* Profile */}
                <div className="border-sidebar-border/70 dark:border-sidebar-border bg-black flex flex-col items-center gap-2 border-b px-4 py-7">
                    <div className="relative">
                        <Avatar className="size-20 overflow-hidden">
                            {avatarUrl ? (
                                <AvatarImage src={avatarUrl} alt={chatName} />
                            ) : isGroup && participants.length > 0 ? (
                                <div className="relative h-full w-full">
                                    {participants.slice(0, 2).map((participant, index) => (
                                        <div
                                            key={participant.id}
                                            className={cn(
                                                'border-background absolute size-12 overflow-hidden rounded-full border-2',
                                                index === 0 ? 'top-0 left-0' : 'right-0 bottom-0',
                                            )}
                                        >
                                            <Avatar className="h-full w-full">
                                                {participant.avatar ? (
                                                    <AvatarImage src={participant.avatar} alt={participant.name} />
                                                ) : (
                                                    <AvatarFallback className="text-xs">{getInitials(participant.name)}</AvatarFallback>
                                                )}
                                            </Avatar>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <AvatarFallback className="text-lg">{getInitials(chatName)}</AvatarFallback>
                            )}
                        </Avatar>

                        {!isGroup && isFriendOnline && (
                            <span className="border-background absolute right-1 bottom-1 size-3.5 rounded-full border-2 bg-green-500" />
                        )}

                        {isGroup && participants.length > 0 && (
                            <label
                                className="bg-primary text-primary-foreground border-background focus-within:ring-ring focus-within:ring-offset-background absolute -right-1 -bottom-1 flex size-7 cursor-pointer items-center justify-center rounded-full border-2 shadow-sm transition-transform hover:scale-105 focus-within:ring-2 focus-within:ring-offset-2 active:scale-95"
                                aria-label="Change group avatar"
                            >
                                <input type="file" name="avatar" accept="image/*" className="sr-only" onChange={handleAvatarChange} />
                                <Camera className="size-3.5" />
                            </label>
                        )}
                    </div>

                    <span className="text-base font-semibold">{chatName}</span>

                    <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        {isGroup ? (
                            <>
                                <span>{participants.length} members</span>
                                {Boolean(onlineUserIds) && onlineCount > 0 && (
                                    <>
                                        <span className="text-muted-foreground/40">·</span>
                                        <span className="inline-flex items-center gap-1">
                                            <span className="size-1.5 rounded-full bg-green-500" />
                                            {onlineCount} online
                                        </span>
                                    </>
                                )}
                            </>
                        ) : isFriendOnline ? (
                            <span className="inline-flex items-center gap-1.5 text-green-600 dark:text-green-500">
                                <span className="size-1.5 rounded-full bg-green-500" />
                                Active now
                            </span>
                        ) : (
                            <span>Offline</span>
                        )}
                    </div>
                </div>

                {/* Members (group only) */}
                {isGroup && (
                    <div className="border-sidebar-border/70 dark:border-sidebar-border border-b px-4 py-4">
                        <SectionHeading icon={Users} label="Members" count={participants.length} />
                        {participants.length === 0 ? (
                            <EmptyState icon={Users} label="No members found" />
                        ) : (
                            <div className="flex flex-col gap-0.5">
                                {participants.map((p) => (
                                    <div
                                        key={p.id}
                                        className="hover:bg-accent/60 flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors"
                                    >
                                        <div className="relative shrink-0">
                                            <Avatar className="size-9">
                                                {p.avatar ? (
                                                    <AvatarImage src={p.avatar} alt={p.name} />
                                                ) : (
                                                    <AvatarFallback className="text-xs">{getInitials(p.name)}</AvatarFallback>
                                                )}
                                            </Avatar>
                                            {onlineUserIds?.has(p.id) && (
                                                <span className="border-background absolute right-0 bottom-0 size-2.5 rounded-full border-2 bg-green-500" />
                                            )}
                                        </div>
                                        <span className="truncate text-sm font-medium">{p.name}</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Media */}
                <div className="border-sidebar-border/70 dark:border-sidebar-border border-b px-4 py-4">
                    <SectionHeading icon={ImageIcon} label="Media" count={media.length} />
                    {media.length === 0 ? (
                        <EmptyState icon={ImageOff} label="No photos or videos yet" />
                    ) : (
                        <div className="grid grid-cols-3 gap-1">
                            {media.map((a) => (
                                <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="group bg-muted focus-visible:ring-ring relative block aspect-square overflow-hidden rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-offset-2"
                                >
                                    {a.kind === 'image' ? (
                                        <img
                                            src={a.url}
                                            alt={a.name}
                                            loading="lazy"
                                            className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
                                        />
                                    ) : (
                                        <>
                                            <video src={a.url} muted preload="metadata" className="h-full w-full object-cover" />
                                            <div className="absolute inset-0 flex items-center justify-center bg-black/20 transition-colors group-hover:bg-black/35">
                                                <Play className="size-5 fill-white text-white" />
                                            </div>
                                        </>
                                    )}
                                </a>
                            ))}
                        </div>
                    )}
                </div>

                {/* Files */}
                <div className="px-4 py-4">
                    <SectionHeading icon={FileIcon} label="Files" count={files.length} />
                    {files.length === 0 ? (
                        <EmptyState icon={Inbox} label="No files shared yet" />
                    ) : (
                        <div className="flex flex-col gap-1.5">
                            {files.map((a) => (
                                <a
                                    key={a.id}
                                    href={a.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    download={a.name}
                                    className="hover:bg-accent focus-visible:ring-ring flex items-center gap-3 rounded-xl border border-sidebar-border/70 px-3 py-2.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-offset-2 dark:border-sidebar-border"
                                >
                                    <div className="bg-muted text-muted-foreground flex size-9 shrink-0 items-center justify-center rounded-lg">
                                        {a.kind === 'pdf' ? <FileText className="size-4" /> : <FileIcon className="size-4" />}
                                    </div>
                                    <div className="flex min-w-0 flex-1 flex-col">
                                        <span className="truncate text-sm font-medium">{a.name}</span>
                                        <span className="text-muted-foreground text-xs">{formatBytes(a.size)}</span>
                                    </div>
                                </a>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </aside>
    );
}