<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class ReactionUpdated implements ShouldBroadcastNow
{
  use InteractsWithSockets, SerializesModels;

  public function __construct(
    public int $conversationId,
    public int $messageId,
    public array $reactions,
  ) {}

  public function broadcastOn(): array
  {
    return [new PrivateChannel('conversation.' . $this->conversationId)];
  }

  public function broadcastAs(): string
  {
    return 'ReactionUpdated';
  }

  public function broadcastWith(): array
  {
    return ['message_id' => $this->messageId, 'reactions' => $this->reactions];
  }
}
