<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class ConversationUpdated implements ShouldBroadcastNow
{
  use InteractsWithSockets, SerializesModels;

  public function __construct(
    public int $userId,
    public array $conversation,
  ) {}

  public function broadcastOn(): array
  {
    return [new PrivateChannel('App.Models.User.' . $this->userId)];
  }

  public function broadcastAs(): string
  {
    return 'ConversationUpdated';
  }

  public function broadcastWith(): array
  {
    return ['conversation' => $this->conversation];
  }
}
