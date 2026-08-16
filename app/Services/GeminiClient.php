<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class GeminiClient
{
    protected string $apiKey;
    protected string $model;

    public function __construct(string $model = 'gemini-2.5-flash')
    {
        $this->apiKey = config('services.gemini.key');
        $this->model = $model;
    }

    public function generate(string $systemInstruction, string $userText, array $generationConfig = []): ?string
    {
        $response = Http::timeout(15)->post(
            "https://generativelanguage.googleapis.com/v1beta/models/{$this->model}:generateContent?key={$this->apiKey}",
            [
                'system_instruction' => ['parts' => [['text' => $systemInstruction]]],
                'contents' => [
                    ['role' => 'user', 'parts' => [['text' => $userText]]],
                ],
                'generationConfig' => array_merge([
                    'maxOutputTokens' => 256,
                    'temperature' => 0.7,
                ], $generationConfig),
            ]
        );

        if ($response->failed()) {
            return null;
        }

        return data_get($response->json(), 'candidates.0.content.parts.0.text');
    }
}
