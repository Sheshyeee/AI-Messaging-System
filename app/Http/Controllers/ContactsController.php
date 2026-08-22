<?php

namespace App\Http\Controllers;

use App\Models\FriendRequest;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;

class ContactsController extends Controller
{
    public function index(Request $request)
    {
        $userId = $request->user()->id;

        // Pending requests sent TO me
        $requests = FriendRequest::with('sender:id,name,email,avatar')
            ->where('receiver_id', $userId)
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(fn($fr) => [
                'id' => $fr->id,
                'sender' => [
                    'id' => $fr->sender->id,
                    'name' => $fr->sender->name,
                    'email' => $fr->sender->email,
                    'avatar_url' => $fr->sender->avatar_url,
                ],
                'created_at' => $fr->created_at->diffForHumans(),
            ]);

        // Every relationship row involving me, so I can compute each user's status
        $relations = FriendRequest::where('sender_id', $userId)
            ->orWhere('receiver_id', $userId)
            ->get();

        $statusFor = function (int $otherId) use ($relations, $userId) {
            $row = $relations->first(
                fn($fr) => $fr->sender_id === $otherId || $fr->receiver_id === $otherId
            );

            if (!$row) {
                return ['status' => 'none', 'request_id' => null];
            }

            if ($row->status === 'accepted') {
                return ['status' => 'friends', 'request_id' => $row->id];
            }

            // pending
            return [
                'status' => $row->sender_id === $userId ? 'pending_sent' : 'pending_received',
                'request_id' => $row->id,
            ];
        };

        $users = User::where('id', '!=', $userId)
            ->select('id', 'name', 'email', 'avatar')
            ->orderBy('name')
            ->get()
            ->map(function ($user) use ($statusFor) {
                $info = $statusFor($user->id);

                return [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'avatar_url' => $user->avatar_url,
                    'status' => $info['status'],
                    'request_id' => $info['request_id'],
                ];
            })
            ->values();

        return inertia('friends/friends', [
            'requests' => $requests,
            'users' => $users,
        ]);
    }

    public function suggestions(Request $request)
    {
        $userId = $request->user()->id;

        // Get every user ID already connected to me in any way (pending or accepted)
        $connectedIds = FriendRequest::where('sender_id', $userId)
            ->orWhere('receiver_id', $userId)
            ->get()
            ->flatMap(function ($friendRequest) {
                return [$friendRequest->sender_id, $friendRequest->receiver_id];
            })
            ->unique();

        $users = User::where('id', '!=', $userId)
            ->whereNotIn('id', $connectedIds)
            ->select('id', 'name', 'email', 'avatar')
            ->orderBy('name')
            ->get()
            ->map(fn($user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'avatar_url' => $user->avatar_url,
            ]);

        return inertia('friends/suggestions', [
            'users' => $users,
        ]);
    }

    public function sendRequest(Request $request, User $user): RedirectResponse
    {
        $sender = $request->user();

        // Prevent sending a request to yourself
        if ($sender->id === $user->id) {
            return back()->withErrors(['user' => 'You cannot add yourself.']);
        }

        // Prevent duplicate requests (in either direction)
        $exists = FriendRequest::where(function ($query) use ($sender, $user) {
            $query->where('sender_id', $sender->id)->where('receiver_id', $user->id);
        })->orWhere(function ($query) use ($sender, $user) {
            $query->where('sender_id', $user->id)->where('receiver_id', $sender->id);
        })->exists();

        if ($exists) {
            return back()->withErrors(['user' => 'A friend request already exists with this user.']);
        }

        FriendRequest::create([
            'sender_id' => $sender->id,
            'receiver_id' => $user->id,
            'status' => 'pending',
        ]);

        return back()->with('status', 'Friend request sent.');
    }

    public function requests(Request $request)
    {
        $requests = FriendRequest::with('sender:id,name,email,avatar')
            ->where('receiver_id', $request->user()->id)
            ->where('status', 'pending')
            ->latest()
            ->get()
            ->map(function ($friendRequest) {
                return [
                    'id' => $friendRequest->id,
                    'sender' => [
                        'id' => $friendRequest->sender->id,
                        'name' => $friendRequest->sender->name,
                        'email' => $friendRequest->sender->email,
                        'avatar_url' => $friendRequest->sender->avatar_url,
                    ],
                    'created_at' => $friendRequest->created_at->diffForHumans(),
                ];
            });

        return inertia('friends/requests', [
            'requests' => $requests,
        ]);
    }

    public function acceptRequest(Request $request, FriendRequest $friendRequest)
    {
        abort_unless($friendRequest->receiver_id === $request->user()->id, 403);

        $friendRequest->update(['status' => 'accepted']);

        return back()->with('status', 'Friend request accepted.');
    }

    public function declineRequest(Request $request, FriendRequest $friendRequest)
    {
        abort_unless($friendRequest->receiver_id === $request->user()->id, 403);

        $friendRequest->delete();

        return back()->with('status', 'Friend request declined.');
    }

    public function allFriends(Request $request)
    {
        $userId = $request->user()->id;

        $friends = FriendRequest::with(['sender:id,name,email,avatar', 'receiver:id,name,email,avatar'])
            ->where('status', 'accepted')
            ->where(function ($query) use ($userId) {
                $query->where('sender_id', $userId)
                    ->orWhere('receiver_id', $userId);
            })
            ->get()
            ->map(function ($friendRequest) use ($userId) {
                // The "friend" is whichever side of the row ISN'T the current user
                $friend = $friendRequest->sender_id === $userId
                    ? $friendRequest->receiver
                    : $friendRequest->sender;

                return [
                    'id' => $friend->id,
                    'name' => $friend->name,
                    'email' => $friend->email,
                    'avatar_url' => $friend->avatar_url,
                    'friends_since' => $friendRequest->updated_at->diffForHumans(),
                ];
            });

        return inertia('friends/all', [
            'friends' => $friends,
        ]);
    }
}
