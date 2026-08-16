<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Support\Facades\Storage;

class Conversation extends Model
{
    protected $fillable = ['user_one_id', 'user_two_id', 'is_group', 'name', 'created_by', 'avatar_path'];

    protected $appends = ['avatar_url'];

    protected $casts = [
        'is_group' => 'boolean',
    ];

    public function getAvatarUrlAttribute(): ?string
    {
        if ($this->is_group) {
            return $this->avatar_path
                ? \Illuminate\Support\Facades\Storage::disk('public')->url($this->avatar_path)
                : null;
        }

        $userId = auth()->id();
        $other = $this->otherUser($userId);

        return $other?->avatar_url;
    }


    public function userOne(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_one_id');
    }

    public function userTwo(): BelongsTo
    {
        return $this->belongsTo(User::class, 'user_two_id');
    }

    public function messages(): HasMany
    {
        return $this->hasMany(Message::class)->orderBy('created_at');
    }

    public function latestMessage(): HasOne
    {
        return $this->hasOne(Message::class)->latestOfMany();
    }

    /**
     * Get the "other" participant relative to the given user.
     */
    public function otherUser(int $currentUserId): User
    {
        return $this->user_one_id === $currentUserId ? $this->userTwo : $this->userOne;
    }

    /**
     * Find an existing conversation between two users, or create one.
     * Always stores the smaller ID as user_one_id to keep the unique constraint consistent.
     */

    public function participants(): BelongsToMany
    {
        return $this->belongsToMany(User::class, 'conversation_participants')->withTimestamps();
    }

    public static function between(int $userA, int $userB): self
    {
        [$one, $two] = $userA < $userB ? [$userA, $userB] : [$userB, $userA];

        $conversation = static::firstOrCreate([
            'user_one_id' => $one,
            'user_two_id' => $two,
            'is_group' => false,
        ]);

        $conversation->participants()->syncWithoutDetaching([$one, $two]);

        return $conversation;
    }

    public static function createGroup(int $creatorId, array $memberIds, ?string $name = null): self
    {
        $conversation = static::create([
            'is_group' => true,
            'name' => $name,
            'created_by' => $creatorId,
        ]);

        $conversation->participants()->attach(array_unique([$creatorId, ...$memberIds]));

        return $conversation;
    }

    public function isParticipant(int $userId): bool
    {
        return $this->participants()->where('user_id', $userId)->exists();
    }

    public function displayNameFor(int $viewerId): string
    {
        if (!$this->is_group) {
            return $this->otherUser($viewerId)->name;
        }

        if ($this->name) {
            return $this->name;
        }

        return $this->participants
            ->reject(fn($u) => $u->id === $viewerId)
            ->pluck('name')
            ->implode(', ') ?: 'Group';
    }
}
