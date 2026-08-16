<?php

use App\Models\Conversation;
use Illuminate\Support\Facades\Broadcast;

Broadcast::channel('conversation.{conversationId}', function ($user, int $conversationId) {
  $conversation = Conversation::find($conversationId);

  if (!$conversation) {
    return false;
  }

  if ($conversation->is_group) {
    return $conversation->isParticipant($user->id);
  }

  return $conversation->user_one_id === $user->id || $conversation->user_two_id === $user->id;
});

Broadcast::channel('App.Models.User.{id}', function ($user, int $id) {
  return (int) $user->id === $id;
});

Broadcast::channel('online-users', function ($user) {
  return ['id' => $user->id, 'name' => $user->name];
});
