<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Session;
use Laravel\Ai\Transcription;

use function Laravel\Ai\agent;

class VoiceAssistantService
{
    private const SESSION_KEY = 'voice_assistant_history';
    private const MAX_HISTORY = 10;

    public function __construct(
        private KnowledgeBaseService $knowledgeBase
    ) {}

    /**
     * Transcribe audio to text using OpenAI Whisper.
     */
    public function transcribe(string $audioPath): string
    {
        $response = Transcription::fromPath($audioPath)
            ->generate(provider: 'openai', model: 'whisper-1');

        return (string) $response;
    }

    /**
     * Generate a response based on the knowledge base with conversation history.
     */
    public function generateResponse(string $query): string
    {
        $knowledgeContext = $this->knowledgeBase->getKnowledgeContext();
        $history = $this->getConversationHistory();
        $historyContext = $this->formatHistoryForContext($history);

        $instructions = <<<PROMPT
You ARE Muhammad Tabraiz - Full Stack Web Developer from Karachi, Pakistan. You speak in FIRST PERSON as yourself.

IMPORTANT INSTRUCTIONS:
1. Always respond as Tabraiz himself, using "I", "my", "me" - never "he" or "his".
2. For greetings or introductions, start with something like: "Hi, I'm Tabraiz! How can I help you?" or "Hey there! I'm Tabraiz, a Full Stack Developer. What would you like to know?"
3. Be friendly, casual, and conversational like a young professional talking to someone.
4. Answer questions about yourself based on the knowledge base provided.
5. If asked about something not in the knowledge base, say something like "Hmm, I don't have that info handy" or "That's not something I can share right now."
6. Keep responses concise - they will be converted to speech.
7. Use the conversation history to maintain context.

CONVERSATION HISTORY:
{$historyContext}

MY INFORMATION (KNOWLEDGE BASE):
{$knowledgeContext}
PROMPT;

        $response = agent(
            instructions: $instructions,
            messages: [],
            tools: [],
        )->prompt($query, provider: 'openai', model: 'gpt-4o-mini');

        $responseText = (string) $response;

        $this->addToHistory($query, $responseText);

        return $responseText;
    }

    /**
     * Get conversation history from session.
     */
    public function getConversationHistory(): array
    {
        return Session::get(self::SESSION_KEY, []);
    }

    /**
     * Add a Q&A pair to conversation history.
     */
    private function addToHistory(string $query, string $response): void
    {
        $history = $this->getConversationHistory();

        $history[] = [
            'query' => $query,
            'response' => $response,
            'timestamp' => now()->toISOString(),
        ];

        // Keep only the last MAX_HISTORY entries
        if (count($history) > self::MAX_HISTORY) {
            $history = array_slice($history, -self::MAX_HISTORY);
        }

        Session::put(self::SESSION_KEY, $history);
    }

    /**
     * Format history for AI context.
     */
    private function formatHistoryForContext(array $history): string
    {
        if (empty($history)) {
            return 'No previous conversation.';
        }

        return collect($history)
            ->map(fn ($item) => "Visitor: {$item['query']}\nTabraiz: {$item['response']}")
            ->implode("\n\n");
    }

    /**
     * Clear conversation history.
     */
    public function clearHistory(): void
    {
        Session::forget(self::SESSION_KEY);
    }

    /**
     * Convert text to speech using ElevenLabs API.
     */
    public function textToSpeech(string $text, string $voiceId = 'TxGEqnHWrfWFTfGW9XjX'): ?string
    {
        $apiKey = config('services.elevenlabs.api_key');

        if (! $apiKey) {
            Log::error('ElevenLabs API key not configured');

            return null;
        }

        $response = Http::withHeaders([
            'xi-api-key' => $apiKey,
            'Content-Type' => 'application/json',
        ])->post("https://api.elevenlabs.io/v1/text-to-speech/{$voiceId}", [
            'text' => $text,
            'model_id' => 'eleven_multilingual_v2',
            'voice_settings' => [
                'stability' => 0.5,
                'similarity_boost' => 0.75,
            ],
        ]);

        if ($response->successful()) {
            return base64_encode($response->body());
        }

        Log::error('ElevenLabs TTS failed', [
            'status' => $response->status(),
            'body' => $response->body(),
        ]);

        return null;
    }

    /**
     * Process a complete voice query: transcribe, generate response, and convert to speech.
     */
    public function processVoiceQuery(string $audioPath): array
    {
        $transcription = $this->transcribe($audioPath);

        if (empty($transcription)) {
            return [
                'success' => false,
                'error' => 'Could not transcribe audio',
            ];
        }

        $response = $this->generateResponse($transcription);
        $audioBase64 = $this->textToSpeech($response);

        return [
            'success' => true,
            'transcription' => $transcription,
            'response' => $response,
            'audio' => $audioBase64,
        ];
    }
}
