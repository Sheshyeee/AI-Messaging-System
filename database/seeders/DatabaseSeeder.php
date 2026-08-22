<?php

namespace Database\Seeders;

use App\Models\Conversation;
use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        $me = User::updateOrCreate(
            ['email' => 'test@example.com'],
            [
                'name' => 'Test User',
                'password' => Hash::make('password'),
                'avatar' => 'https://i.pravatar.cc/300?img=12',
                'email_verified_at' => now(),
            ]
        );

        $names = [
            ['Ava Thompson', 'ava@example.com', 5],
            ['Liam Carter', 'liam@example.com', 8],
            ['Sophia Nguyen', 'sophia@example.com', 15],
            ['Noah Patel', 'noah@example.com', 22],
            ['Isabella Rossi', 'isabella@example.com', 29],
            ['Ethan Walker', 'ethan@example.com', 33],
            ['Mia Johansson', 'mia@example.com', 44],
            ['Lucas Kim', 'lucas@example.com', 51],
        ];

        $users = collect($names)->map(function ($row) {
            [$name, $email, $avatarSeed] = $row;

            return User::updateOrCreate(
                ['email' => $email],
                [
                    'name' => $name,
                    'password' => Hash::make('password'),
                    'avatar' => "https://i.pravatar.cc/300?img={$avatarSeed}",
                    'email_verified_at' => now(),
                ]
            );
        });

        // --- Friend requests -------------------------------------------------

        $accepted = $users->take(4);

        foreach ($accepted as $friend) {
            $this->upsertFriendRequest($me->id, $friend->id, 'accepted');
        }

        // Pending request sent TO me (Isabella -> me)
        $this->upsertFriendRequest($users[4]->id, $me->id, 'pending');

        // Pending request sent BY me (me -> Ethan)
        $this->upsertFriendRequest($me->id, $users[5]->id, 'pending');

        // $users[6] Mia, $users[7] Lucas intentionally left unconnected

        // --- 1:1 conversations with the accepted friends ----------------------

        $conversations = [];

        foreach ($accepted as $i => $friend) {
            $conversation = Conversation::between($me->id, $friend->id);
            $conversations[] = $conversation;

            // Only seed messages the first time this conversation is empty,
            // so re-running db:seed doesn't pile up duplicate messages.
            if ($conversation->messages()->exists()) {
                continue;
            }

            $lines = [
                ['from' => $friend, 'body' => 'Hey! Long time no chat 👋'],
                ['from' => $me, 'body' => "I know, it's been way too long!"],
                ['from' => $friend, 'body' => 'We should catch up soon.'],
                ['from' => $me, 'body' => 'Definitely, are you free this weekend?'],
                ['from' => $friend, 'body' => 'Yeah! Saturday works for me.'],
            ];

            foreach ($lines as $j => $line) {
                $conversation->messages()->create([
                    'sender_id' => $line['from']->id,
                    'body' => $line['body'],
                    'read_at' => $j < 4 ? now()->subMinutes(60 - $j * 10) : null,
                    'created_at' => now()->subMinutes((5 - $j) * 12 + $i),
                    'updated_at' => now()->subMinutes((5 - $j) * 12 + $i),
                ]);
            }
        }

        // React to the last message of the first conversation, once.
        $lastMessage = $conversations[0]->messages()->latest()->first();
        if ($lastMessage) {
            $lastMessage->reactions()->firstOrCreate(
                ['user_id' => $me->id],
                ['emoji' => '👍']
            );
        }

        // --- A group conversation with several friends -------------------------

        $group = Conversation::query()
            ->where('is_group', true)
            ->where('name', 'Weekend Crew')
            ->where('created_by', $me->id)
            ->first();

        if (!$group) {
            $group = Conversation::createGroup(
                $me->id,
                $accepted->pluck('id')->all(),
                'Weekend Crew'
            );
        } else {
            // Make sure all expected members are still attached even on re-run.
            $group->participants()->syncWithoutDetaching(
                [$me->id, ...$accepted->pluck('id')->all()]
            );
        }

        if (!$group->messages()->exists()) {
            $groupLines = [
                [$accepted[0], "Who's in for Saturday?"],
                [$accepted[1], "I'm in!"],
                [$me, 'Count me in too.'],
                [$accepted[2], 'Same here, what time?'],
                [$accepted[0], "Let's say 3pm at the usual spot."],
                [$accepted[3], 'Works for me 🙌'],
            ];

            foreach ($groupLines as $k => [$sender, $body]) {
                $group->messages()->create([
                    'sender_id' => $sender->id,
                    'body' => $body,
                    'created_at' => now()->subMinutes((count($groupLines) - $k) * 8),
                    'updated_at' => now()->subMinutes((count($groupLines) - $k) * 8),
                ]);
            }
        }
    }

    /**
     * Create or update a friend request row between two users, keyed on the
     * unique (sender_id, receiver_id) pair so this is safe to re-run.
     */
    private function upsertFriendRequest(int $senderId, int $receiverId, string $status): void
    {
        FriendRequest::updateOrCreate(
            ['sender_id' => $senderId, 'receiver_id' => $receiverId],
            ['status' => $status]
        );
    }
}
