import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { router } from '@inertiajs/react';
import { X } from 'lucide-react';
import { useState, type FormEventHandler } from 'react';

export interface GroupFriendOption {
    id: number;
    name: string;
}

interface NewGroupDialogProps {
    friends: GroupFriendOption[];
    open: boolean;
    onClose: () => void;
}

function getInitials(name: string) {
    return name
        .split(' ')
        .map((p) => p[0])
        .join('')
        .slice(0, 2)
        .toUpperCase();
}

export function NewGroupDialog({ friends, open, onClose }: NewGroupDialogProps) {
    const [name, setName] = useState('');
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [submitting, setSubmitting] = useState(false);

    if (!open) return null;

    const toggle = (id: number) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
        });
    };

    const handleClose = () => {
        setName('');
        setSelectedIds(new Set());
        setSubmitting(false);
        onClose();
    };

    const handleSubmit: FormEventHandler = (e) => {
        e.preventDefault();
        if (selectedIds.size === 0 || submitting) return;

        setSubmitting(true);
        router.post(
            route('chats.startGroup'),
            { name: name.trim() || null, member_ids: Array.from(selectedIds) },
            { onSuccess: handleClose, onFinish: () => setSubmitting(false) },
        );
    };

    return (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={handleClose}>
            <div
                className="bg-background flex max-h-[85dvh] w-full flex-col rounded-t-2xl border shadow-lg sm:max-h-[80vh] sm:max-w-sm sm:rounded-xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mx-auto mt-2 h-1 w-10 shrink-0 rounded-full bg-muted-foreground/20 sm:hidden" aria-hidden="true" />
                <div className="flex items-center justify-between border-b px-4 py-3">
                    <h2 className="text-sm font-semibold">New group</h2>
                    <button type="button" onClick={handleClose} className="hover:bg-accent rounded-full p-1.5" aria-label="Close">
                        <X className="size-4" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="flex flex-1 flex-col overflow-hidden">
                    <div className="px-4 pt-3 pb-2">
                        <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="Group name (optional)" />
                    </div>

                    <div className="text-muted-foreground px-4 pb-1 text-xs">
                        {selectedIds.size === 0 ? 'Select at least one friend' : `${selectedIds.size} selected`}
                    </div>

                    <div className="flex-1 space-y-0.5 overflow-y-auto px-2 pb-2">
                        {friends.length === 0 ? (
                            <p className="text-muted-foreground px-2 py-4 text-center text-sm">Add some friends first.</p>
                        ) : (
                            friends.map((friend) => {
                                const checked = selectedIds.has(friend.id);
                                return (
                                    <button
                                        key={friend.id}
                                        type="button"
                                        onClick={() => toggle(friend.id)}
                                        className={`flex w-full items-center gap-3 rounded-lg px-2 py-2.5 text-left transition-colors ${checked ? 'bg-primary/10' : 'hover:bg-accent'}`}
                                    >
                                        <Avatar className="size-9">
                                            <AvatarFallback>{getInitials(friend.name)}</AvatarFallback>
                                        </Avatar>
                                        <span className="min-w-0 flex-1 truncate text-sm">{friend.name}</span>
                                        <span
                                            className={`flex size-5 shrink-0 items-center justify-center rounded-full border ${checked ? 'bg-primary border-primary' : 'border-muted-foreground'}`}
                                        >
                                            {checked && <span className="bg-background size-1.5 rounded-full" />}
                                        </span>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    <div className="border-t px-4 py-3 pb-[calc(var(--spacing)+env(safe-area-inset-bottom))]">
                        <Button type="submit" className="w-full rounded-full" disabled={selectedIds.size === 0 || submitting}>
                            {submitting ? 'Creating…' : 'Create group'}
                        </Button>
                    </div>
                </form>
            </div>
        </div>
    );
}