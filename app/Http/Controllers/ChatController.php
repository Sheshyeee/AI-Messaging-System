<?php

namespace App\Http\Controllers;

use App\Events\ConversationUpdated;
use App\Events\MessageSent;
use App\Events\MessagesRead;
use App\Events\ReactionUpdated;
use App\Models\Conversation;
use App\Models\FriendRequest;
use App\Models\Message;
use App\Models\MessageAttachment;
use App\Services\SmartReplyService;
use Illuminate\Foundation\Auth\Access\AuthorizesRequests;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

class ChatController extends Controller
{
    use AuthorizesRequests;

    private const MAX_ATTACHMENT_KB = 25600; // 25MB per file
    private const MAX_ATTACHMENTS = 10;
    private const ALLOWED_MIMES = 'jpg,jpeg,png,gif,webp,heic,mp4,mov,webm,pdf,doc,docx,xls,xlsx,ppt,pptx,zip,txt,csv,mp3,wav,ogg,m4a,weba';
    private const ALLOWED_REACTIONS = ['👍', '❤️', '😆', '😮', '😢', '😡'];

    public function index(Request $request): Response
    {
        return Inertia::render('chats/chats', [
            'conversations' => fn() => $this->conversationsFor($request->user()->id),
            'friends' => fn() => $this->friendsFor($request->user()->id),
        ]);
    }

    public function show(Request $request, Conversation $conversation): Response
    {
        $this->authorize('view', $conversation);
        $userId = $request->user()->id;

        $updated = $conversation->messages()
            ->where('sender_id', '!=', $userId)
            ->whereNull('read_at')
            ->update(['read_at' => now()]);

        if ($updated > 0) {
            broadcast(new MessagesRead(
                conversationId: $conversation->id,
                readerId: $userId,
                readerName: $request->user()->name,
                readAt: now()->toIso8601String(),
            ))->toOthers();
        }

        return Inertia::render('chats/chats', [
            'conversations' => fn() => $this->conversationsFor($userId),
            'friends' => fn() => $this->friendsFor($userId),
            'activeConversation' => [
                'id' => $conversation->id,
                'name' => $conversation->displayNameFor($userId),
                'friendId' => $conversation->is_group ? null : $conversation->otherUser($userId)->id,
                'isGroup' => $conversation->is_group,
                'avatarUrl' => $conversation->avatar_url,
                'participants' => $conversation->is_group
                    ? $conversation->participants->map(fn($p) => ['id' => $p->id, 'name' => $p->name, 'avatar' => $p->avatar ?? null])->values()
                    : [],
            ],
            'messages' => fn() => $this->messagesFor($conversation, $userId),
        ]);
    }

    public function startConversation(Request $request)
    {
        $validated = $request->validate([
            'friend_id' => ['required', 'integer', 'exists:users,id'],
        ]);

        $userId = $request->user()->id;
        abort_if($validated['friend_id'] === $userId, 422, 'You cannot message yourself.');

        $conversation = Conversation::between($userId, $validated['friend_id']);

        return redirect()->route('chats.show', $conversation);
    }

    public function startGroupConversation(Request $request)
    {
        $validated = $request->validate([
            'name' => ['nullable', 'string', 'max:100'],
            'member_ids' => ['required', 'array', 'min:1'],
            'member_ids.*' => ['integer', 'exists:users,id'],
        ]);

        $userId = $request->user()->id;
        $memberIds = array_values(array_unique(array_diff($validated['member_ids'], [$userId])));

        abort_if(count($memberIds) < 1, 422, 'A group needs at least one other member.');

        $conversation = Conversation::createGroup($userId, $memberIds, $validated['name'] ?? null);

        return redirect()->route('chats.show', $conversation);
    }

    public function sendMessage(Request $request, Conversation $conversation)
    {
        $this->authorize('view', $conversation);
        $userId = $request->user()->id;

        $validated = $request->validate([
            'body' => ['nullable', 'string', 'max:2000', 'required_without:attachments'],
            'attachments' => ['nullable', 'array', 'max:' . self::MAX_ATTACHMENTS],
            'attachments.*' => [
                'file',
                'max:' . self::MAX_ATTACHMENT_KB,
                'mimes:' . self::ALLOWED_MIMES,
            ],
        ]);

        $message = $conversation->messages()->create([
            'sender_id' => $userId,
            'body' => $validated['body'] ?? '',
        ]);

        /** @var UploadedFile[] $files */
        $files = $request->file('attachments', []);

        foreach ($files as $file) {
            $path = $file->store('attachments/' . $conversation->id, 's3');

            $message->attachments()->create([
                'disk' => 's3',
                'path' => $path,
                'original_name' => $file->getClientOriginalName(),
                'mime_type' => $file->getClientMimeType(),
                'size' => $file->getSize(),
            ]);
        }

        $conversation->touch();

        $message->load(['attachments', 'reactions', 'sender:id,name,avatar']);
        broadcast(new MessageSent(
            message: $this->serializeMessage($message, $userId),
            conversationId: $conversation->id,
            senderId: $userId,
        ))->toOthers();

        $recipientIds = $conversation->is_group
            ? $conversation->participants()->where('user_id', '!=', $userId)->pluck('users.id')
            : collect([$conversation->otherUser($userId)->id]);

        foreach ($recipientIds as $recipientId) {
            $this->broadcastConversationUpdate($conversation, $message, $recipientId);
        }

        return back();
    }

    public function updateAvatar(Request $request, Conversation $conversation)
    {
        $this->authorize('view', $conversation);

        $validated = $request->validate([
            'avatar' => ['required', 'file', 'image', 'max:' . self::MAX_ATTACHMENT_KB],
        ]);

        $path = $request->file('avatar')->store('conversation-avatars/' . $conversation->id, 's3');
        $conversation->update(['avatar_path' => $path]);

        return back();
    }

    private function conversationsFor(int $userId)
    {
        return Conversation::with(['userOne:id,name,avatar', 'userTwo:id,name,avatar', 'latestMessage.attachments', 'participants:id,name,avatar'])
            ->whereHas('participants', fn($q) => $q->where('user_id', $userId))
            ->whereHas('messages')
            ->withCount(['messages as unread_count' => function ($query) use ($userId) {
                $query->where('sender_id', '!=', $userId)->whereNull('read_at');
            }])
            ->get()
            ->map(function (Conversation $conversation) use ($userId) {
                $last = $conversation->latestMessage;

                return [
                    'id' => $conversation->id,
                    'name' => $conversation->displayNameFor($userId),
                    'friend_id' => $conversation->is_group ? null : $conversation->otherUser($userId)->id,
                    'is_group' => $conversation->is_group,
                    'last_message' => $this->previewFor($last),
                    'last_message_from_me' => $last->sender_id === $userId,
                    'last_message_sender_name' => $conversation->is_group && $last->sender_id !== $userId
                        ? $conversation->participants->firstWhere('id', $last->sender_id)?->name
                        : null,
                    'avatar_url' => $conversation->avatar_url,
                    'participant_avatars' => $conversation->is_group
                        ? $conversation->participants
                        ->where('id', '!=', $userId)
                        ->shuffle()
                        ->take(2)
                        ->map(fn($p) => ['id' => $p->id, 'name' => $p->name, 'avatar' => $p->avatar ?? null])
                        ->values()
                        : [],
                    'participant_ids' => $conversation->is_group
                        ? $conversation->participants->where('id', '!=', $userId)->pluck('id')->values()->all()
                        : [],
                    'timestamp' => $last->created_at->diffForHumans(short: true),
                    'sort_time' => $last->created_at->timestamp,
                    'unread' => $conversation->unread_count > 0,
                    'unread_count' => $conversation->unread_count,
                ];
            })
            ->sortByDesc('sort_time')
            ->values();
    }

    private function previewFor(Message $message): string
    {
        if ($message->body !== '') {
            return $message->body;
        }

        $count = $message->attachments->count();
        if ($count === 0) {
            return '';
        }

        $firstKind = $message->attachments->first()->kind();
        $label = match ($firstKind) {
            'image' => 'Photo',
            'video' => 'Video',
            'pdf' => 'PDF',
            default => 'File',
        };

        return $count > 1 ? "📎 {$count} attachments" : "📎 {$label}";
    }

    private function friendsFor(int $userId)
    {
        return FriendRequest::with(['sender:id,name', 'receiver:id,name'])
            ->where('status', 'accepted')
            ->where(fn($q) => $q->where('sender_id', $userId)->orWhere('receiver_id', $userId))
            ->get()
            ->map(function (FriendRequest $friendRequest) use ($userId) {
                $friend = $friendRequest->sender_id === $userId ? $friendRequest->receiver : $friendRequest->sender;

                return ['id' => $friend->id, 'name' => $friend->name];
            })
            ->values();
    }

    private function serializeMessage(Message $message, int $userId): array
    {
        return [
            'id' => $message->id,
            'body' => $message->body,
            'from_me' => $message->sender_id === $userId,
            'sender_id' => $message->sender_id,
            'sender_name' => $message->sender->name ?? null,
            'sender_avatar_url' => $message->sender->avatar_url ?? null,
            'timestamp' => $message->created_at->format('g:i A'),
            'created_at' => $message->created_at->toIso8601String(),
            'read_at' => $message->read_at?->toIso8601String(),
            'attachments' => $message->attachments->map(fn(MessageAttachment $a) => [
                'id' => $a->id,
                'url' => $a->url(),
                'name' => $a->original_name,
                'mime_type' => $a->mime_type,
                'size' => $a->size,
                'kind' => $a->kind(),
            ]),
            'reactions' => $this->reactionsFor($message, $userId),
        ];
    }

    private function messagesFor(Conversation $conversation, int $userId)
    {
        return $conversation->messages()
            ->with(['attachments', 'reactions', 'sender:id,name,avatar'])
            ->get()
            ->map(fn(Message $message) => $this->serializeMessage($message, $userId));
    }

    private function reactionsFor(Message $message, int $userId)
    {
        return $message->reactions
            ->groupBy('emoji')
            ->map(fn($group, $emoji) => [
                'emoji' => $emoji,
                'count' => $group->count(),
                'reacted_by_me' => $group->contains('user_id', $userId),
            ])
            ->values();
    }

    public function react(Request $request, Conversation $conversation, Message $message)
    {
        $this->authorize('view', $conversation);
        abort_unless($message->conversation_id === $conversation->id, 404);

        $validated = $request->validate([
            'emoji' => ['required', 'string', Rule::in(self::ALLOWED_REACTIONS)],
        ]);

        $userId = $request->user()->id;
        $existing = $message->reactions()->where('user_id', $userId)->first();

        if ($existing && $existing->emoji === $validated['emoji']) {
            $existing->delete();
        } elseif ($existing) {
            $existing->update(['emoji' => $validated['emoji']]);
        } else {
            $message->reactions()->create(['user_id' => $userId, 'emoji' => $validated['emoji']]);
        }

        $message->load('reactions');
        broadcast(new ReactionUpdated(
            conversationId: $conversation->id,
            messageId: $message->id,
            reactions: $this->reactionsForBroadcast($message)->toArray(),
        ))->toOthers();

        return back();
    }

    public function smartReplies(Request $request, Conversation $conversation, SmartReplyService $service)
    {
        $this->authorize('view', $conversation);

        $suggestions = $service->suggestionsFor($conversation, $request->user()->id);

        return response()->json(['suggestions' => $suggestions]);
    }
    private function broadcastConversationUpdate(Conversation $conversation, Message $message, int $recipientId): void
    {
        $unreadCount = $conversation->messages()
            ->where('sender_id', '!=', $recipientId)
            ->whereNull('read_at')
            ->count();

        broadcast(new ConversationUpdated(
            userId: $recipientId,
            conversation: [
                'id' => $conversation->id,
                'name' => $conversation->displayNameFor($recipientId),
                'friend_id' => $conversation->is_group ? null : $message->sender_id,
                'is_group' => $conversation->is_group,
                'last_message' => $this->previewFor($message),
                'last_message_from_me' => false,
                'timestamp' => $message->created_at->diffForHumans(short: true),
                'sort_time' => $message->created_at->timestamp,
                'unread' => true,
                'unread_count' => $unreadCount,
                'participant_ids' => $conversation->is_group
                    ? $conversation->participants()->where('users.id', '!=', $recipientId)->pluck('users.id')->values()->all()
                    : [],
            ],
        ));
    }

    /** Reaction shape without a viewer-specific reacted_by_me — client resolves that itself. */
    private function reactionsForBroadcast(Message $message)
    {
        return $message->reactions
            ->groupBy('emoji')
            ->map(fn($group, $emoji) => [
                'emoji' => $emoji,
                'count' => $group->count(),
                'user_ids' => $group->pluck('user_id')->values(),
            ])
            ->values();
    }
}
