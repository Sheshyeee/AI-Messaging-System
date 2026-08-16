<?php

namespace App\Events;

use App\Models\Message;
use Illuminate\Broadcasting\Channel;
use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PresenceChannel;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class MessageSent implements ShouldBroadcastNow
{
  use InteractsWithSockets, SerializesModels;

  public function __construct(
    public array $message,
    public int $conversationId,
    public int $senderId,
  ) {}

  public function broadcastOn(): array
  {
    return [new PrivateChannel('conversation.' . $this->conversationId)];
  }

  public function broadcastAs(): string
  {
    return 'MessageSent';
  }

  public function broadcastWith(): array
  {
    return ['message' => $this->message];
  }
}
