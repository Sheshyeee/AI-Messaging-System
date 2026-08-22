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

        // --- Friend requests (demo user <-> demo user) --------------------

        $accepted = $users->take(4);

        foreach ($accepted as $friend) {
            $this->upsertFriendRequest($me->id, $friend->id, 'accepted');
        }

        // Pending request sent TO me (Isabella -> me)
        $this->upsertFriendRequest($users[4]->id, $me->id, 'pending');

        // Pending request sent BY me (me -> Ethan)
        $this->upsertFriendRequest($me->id, $users[5]->id, 'pending');

        // $users[6] Mia, $users[7] Lucas intentionally left unconnected

        // --- 1:1 conversations for the demo "me" account -------------------

        $conversations = [];

        foreach ($accepted as $i => $friend) {
            $conversation = Conversation::between($me->id, $friend->id);
            $conversations[] = $conversation;
            $this->seedConversationMessages($conversation, $me, $friend, $i);
        }

        // React to the last message of the first conversation, once.
        $lastMessage = $conversations[0]->messages()->latest()->first();
        if ($lastMessage) {
            $lastMessage->reactions()->firstOrCreate(
                ['user_id' => $me->id],
                ['emoji' => '👍']
            );
        }

        // --- Group conversation with the demo friends -----------------------

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

        // --- Connect EVERY real, already-existing account into the network ---
        // Whatever account you actually log in with (signed up through the
        // real registration form) gets friended with the demo users and a
        // few populated conversations, plus a seat in the group chat.

        $seededEmails = $users->pluck('email')->push('test@example.com');

        $realUsers = User::whereNotIn('email', $seededEmails)->get();

        foreach ($realUsers as $realUser) {
            // Friend the real user with me.
            $this->upsertFriendRequest($me->id, $realUser->id, 'accepted');

            // Friend with ALL demo users so Friends/All friends is populated too.
            foreach ($users as $demoUser) {
                $this->upsertFriendRequest($realUser->id, $demoUser->id, 'accepted');
            }

            // 1:1 conversation + messages with "me".
            $withMe = Conversation::between($realUser->id, $me->id);
            $this->seedConversationMessages($withMe, $realUser, $me, 0);

            // 1:1 conversations + messages with 6 demo friends, so the chat list
            // has real, distinct threads instead of just one or two.
            foreach ($users->take(6) as $i => $demoFriend) {
                $conversation = Conversation::between($realUser->id, $demoFriend->id);
                $this->seedConversationMessages($conversation, $realUser, $demoFriend, $i + 1);
            }

            // Add them into the group chat.
            $group->participants()->syncWithoutDetaching([$realUser->id]);
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

    /**
     * Seed a short back-and-forth in a 1:1 conversation, only if it's empty,
     * so re-running db:seed doesn't pile up duplicate messages.
     */
    private function seedConversationMessages(Conversation $conversation, User $userA, User $userB, int $offset = 0): void
    {
        if ($conversation->messages()->exists()) {
            return;
        }

        $lines = [
            ['from' => $userB, 'body' => 'Hey! Long time no chat 👋'],
            ['from' => $userA, 'body' => "I know, it's been way too long!"],
            ['from' => $userB, 'body' => 'We should catch up soon.'],
            ['from' => $userA, 'body' => 'Definitely, are you free this weekend?'],
            ['from' => $userB, 'body' => 'Yeah! Saturday works for me.'],
        ];

        foreach ($lines as $j => $line) {
            $conversation->messages()->create([
                'sender_id' => $line['from']->id,
                'body' => $line['body'],
                'read_at' => $j < 4 ? now()->subMinutes(60 - $j * 10) : null,
                'created_at' => now()->subMinutes((5 - $j) * 12 + $offset),
                'updated_at' => now()->subMinutes((5 - $j) * 12 + $offset),
            ]);
        }
    }
}
