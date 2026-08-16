<?php

use App\Http\Controllers\ChatController;
use App\Http\Controllers\ContactsController;
use App\Http\Controllers\Settings\ProfileController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;

Route::get('/', function () {
    return Inertia::render('welcome');
})->name('home');

Route::middleware(['auth', 'verified'])->group(function () {
    Route::get('/friends', [ContactsController::class, 'index']);
    Route::get('/friends/suggestions', [ContactsController::class, 'suggestions']);
    Route::get('friends/requests', [ContactsController::class, 'requests'])->name('friends.requests');
    Route::get('friends/all', [ContactsController::class, 'allFriends'])->name('friends.all');

    Route::post('/friends/suggestions/{user}/send-request', [ContactsController::class, 'sendRequest'])->name('friends.sendRequest');
    Route::post('friend-requests/{friendRequest}/accept', [ContactsController::class, 'acceptRequest'])->name('friends.accept');
    Route::delete('friend-requests/{friendRequest}', [ContactsController::class, 'declineRequest'])->name('friends.decline');

    Route::get('/chats', [ChatController::class, 'index'])->name('chats');
    Route::get('/chats/{conversation}', [ChatController::class, 'show'])->name('chats.show');
    Route::post('/conversations/start', [ChatController::class, 'startConversation'])->name('chats.start');
    Route::post('/chats/{conversation}/messages', [ChatController::class, 'sendMessage'])->name('chats.send');
    Route::post('/chats/{conversation}/messages/{message}/react', [ChatController::class, 'react'])->name('messages.react');
    Route::post('/chats/{conversation}/avatar', [ChatController::class, 'updateAvatar'])->name('chats.avatar');

    Route::post('conversations/start-group', [ChatController::class, 'startGroupConversation'])->name('chats.startGroup');

    Route::get('/profile', [ProfileController::class, 'index']);

    Route::get('/chats/{conversation}/smart-replies', [ChatController::class, 'smartReplies'])->name('chats.smartReplies');
});

require __DIR__ . '/settings.php';
require __DIR__ . '/auth.php';
