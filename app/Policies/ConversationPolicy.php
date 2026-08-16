<?php

namespace App\Policies;

use App\Models\Conversation;
use App\Models\User;

class ConversationPolicy
{
    public function view(User $user, Conversation $conversation): bool
    {
        if ($conversation->is_group) {
            return $conversation->isParticipant($user->id);
        }

        return $conversation->user_one_id === $user->id || $conversation->user_two_id === $user->id;
    }
}
