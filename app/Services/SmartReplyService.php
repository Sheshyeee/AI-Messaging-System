<?php

namespace App\Services;

use App\Models\Conversation;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;

class SmartReplyService
{
  public function __construct(protected GeminiClient $gemini) {}

  public function suggestionsFor(Conversation $conversation, int $currentUserId): array
  {
    $lastMessage = $conversation->messages()->reorder()->latest()->first();

    if (!$lastMessage) {
      return [];
    }

    if ($lastMessage->sender_id === $currentUserId) {
      Log::info('smart-replies: last message is from current user, skipping', [
        'last_message_id' => $lastMessage->id,
        'sender_id' => $lastMessage->sender_id,
        'current_user_id' => $currentUserId,
      ]);
      return [];
    }

    $cacheKey = "smart-replies:{$conversation->id}:{$lastMessage->id}:{$currentUserId}";

    $cached = Cache::get($cacheKey);
    if ($cached !== null) {
      return $cached;
    }

    $recent = $conversation->messages()
      ->with('sender:id,name')
      ->reorder()
      ->latest()
      ->take(8)
      ->get()
      ->reverse()
      ->values();

    $transcript = $recent->map(function ($msg) use ($currentUserId) {
      $speaker = $msg->sender_id === $currentUserId ? 'Me' : ($msg->sender->name ?? 'Them');
      $body = $msg->body !== '' ? $msg->body : '[attachment]';
      return "{$speaker}: {$body}";
    })->implode("\n");

    Log::info('smart-replies: calling gemini', ['transcript' => $transcript]);

    $text = $this->gemini->generate(
      systemInstruction: 'You are a smart reply assistant for a chat app used by Filipino users. '
        . 'Given a conversation transcript, suggest 3 natural, contextually appropriate reply options '
        . 'that "Me" might plausibly send next. '
        . 'IMPORTANT RULES: '
        . '1. Reply in Tagalog (Filipino) with a natural mix of casual Taglish (Tagalog + English) as Filipinos typically chat. '
        . '2. Each reply should be 1-2 short sentences (5-15 words) — natural and conversational, not too short. '
        . '3. Match the tone of the conversation (casual, formal, excited, concerned, etc.). '
        . '4. If the other person asked a question, provide a helpful answer. '
        . '5. If they shared news, respond appropriately (congratulate, sympathize, etc.). '
        . '6. Use common Filipino expressions naturally (e.g., "sige", "okay", "ganun ba", "salamat", "walang anuman"). '
        . '7. Output ONLY a JSON array of 3 reply strings. No preamble, no markdown, no explanation.',
      userText: $transcript,
      generationConfig: [
        'maxOutputTokens' => 500,
        'responseMimeType' => 'application/json',
        'responseSchema' => [
          'type' => 'ARRAY',
          'items' => ['type' => 'STRING'],
          'maxItems' => 3,
        ],
        'thinkingConfig' => [
          'thinkingBudget' => 0,
        ],
      ]
    );

    Log::info('smart-replies: gemini raw response', ['text' => $text]);

    $result = [];

    // If Gemini didn't return anything, or returned unparsable JSON,
    // fall back to a rule-based suggestion generator so the UI
    // still shows helpful options.
    if ($text) {
      try {
        // Defensive: pull out the [...] block in case of stray preamble/markdown.
        if (preg_match('/\[.*\]/s', $text, $m)) {
          $text = $m[0];
        }
        $suggestions = json_decode($text, true);
        if (is_array($suggestions)) {
          $result = array_slice(array_values(array_filter($suggestions, 'is_string')), 0, 3);
        }
      } catch (\Throwable $e) {
        Log::warning('smart-replies: failed to parse gemini json', ['error' => $e->getMessage()]);
        $result = [];
      }
    }

    if (empty($result)) {
      // Basic heuristic fallback based on the last message body — Tagalog-friendly.
      $body = strtolower(trim($lastMessage->body));

      if ($body === '' || $body === '[attachment]') {
        $result = ['Sige, noted! 👍', 'Okay, salamat!', 'Ganun ba? Sige sige'];
      } elseif (str_contains($body, '?') || str_contains($body, 'ba') || str_contains($body, 'ano')) {
        $result = ['Oo, sige!', 'Hindi eh, sorry', 'Tingnan ko muna, update kita'];
      } elseif (str_contains($body, 'thank') || str_contains($body, 'salamat')) {
        $result = ['Walang anuman! 😊', 'No problem, anytime!', 'Sige lang, nandito lang ako'];
      } elseif (str_contains($body, 'call') || str_contains($body, 'meet') || str_contains($body, 'schedule') || str_contains($body, 'kita')) {
        $result = ['Sige, anong oras?', 'Okay lang sa akin, ikaw bahala', 'Game! Saan tayo magkita?'];
      } elseif (str_contains($body, 'sad') || str_contains($body, 'malungkot') || str_contains($body, 'problem')) {
        $result = ['Okay ka lang? Nandito lang ako', 'Kaya mo yan, laban lang! 💪', 'Sabihin mo lang kung may kailangan ka'];
      } elseif (str_contains($body, 'congrats') || str_contains($body, 'celebrate') || str_contains($body, 'win')) {
        $result = ['Congrats! Deserve mo yan! 🎉', 'Ang galing! Proud ako sa yo', 'Sige, celebrate tayo soon!'];
      } else {
        $result = ['Sige, sige. Gets ko', 'Okay, noted yan', 'Salamat sa update!'];
      }
    }

    if (!empty($result)) {
      Cache::put($cacheKey, $result, now()->addMinutes(10));
    }

    return $result;
  }
}