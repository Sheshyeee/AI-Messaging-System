<?php

namespace App\Events;

use Illuminate\Broadcasting\InteractsWithSockets;
use Illuminate\Broadcasting\PrivateChannel;
use Illuminate\Contracts\Broadcasting\ShouldBroadcastNow;
use Illuminate\Queue\SerializesModels;

class MessagesRead implements ShouldBroadcastNow
{
  use InteractsWithSockets, SerializesModels;

  public function __construct(
    public int $conversationId,
    public int $readerId,
    public string $readerName,
    public string $readAt,
  ) {}

  public function broadcastOn(): array
  {
    return [new PrivateChannel('conversation.' . $this->conversationId)];
  }

  public function broadcastAs(): string
  {
    return 'MessagesRead';
  }

  public function broadcastWith(): array
  {
    return [
      'reader_id' => $this->readerId,
      'reader_name' => $this->readerName,
      'read_at' => $this->readAt,
    ];
  }
}
