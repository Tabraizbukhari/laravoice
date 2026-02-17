<?php

namespace App\Http\Controllers;

use App\Services\VoiceAssistantService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class VoiceAssistantController extends Controller
{
    public function __construct(
        private VoiceAssistantService $voiceAssistant
    ) {}

    /**
     * Show the voice assistant page.
     */
    public function index(): Response
    {
        return Inertia::render('voice-assistant', [
            'history' => $this->voiceAssistant->getConversationHistory(),
        ]);
    }

    /**
     * Process voice input: transcribe, generate response, and convert to speech.
     */
    public function process(Request $request): JsonResponse
    {
        $request->validate([
            'audio' => 'required|file|mimes:webm,mp3,wav,m4a,ogg|max:10240',
        ]);

        try {
            $audioFile = $request->file('audio');
            $path = $audioFile->store('temp-audio');
            $fullPath = Storage::path($path);

            $transcription = $this->voiceAssistant->transcribe($fullPath);

            Storage::delete($path);

            if (empty($transcription)) {
                return response()->json([
                    'success' => false,
                    'error' => 'Could not transcribe audio. Please speak clearly and try again.',
                ], 422);
            }

            $response = $this->voiceAssistant->generateResponse($transcription);
            $audioBase64 = $this->voiceAssistant->textToSpeech($response);

            return response()->json([
                'success' => true,
                'query' => $transcription,
                'response' => $response,
                'audio' => $audioBase64,
                'history' => $this->voiceAssistant->getConversationHistory(),
            ]);
        } catch (\Exception $e) {
            Log::error('Voice assistant error', [
                'message' => $e->getMessage(),
                'trace' => $e->getTraceAsString(),
            ]);

            return response()->json([
                'success' => false,
                'error' => 'An error occurred while processing your request.',
            ], 500);
        }
    }

    /**
     * Get conversation history.
     */
    public function history(): JsonResponse
    {
        return response()->json([
            'success' => true,
            'history' => $this->voiceAssistant->getConversationHistory(),
        ]);
    }

    /**
     * Clear conversation history.
     */
    public function clearHistory(): JsonResponse
    {
        $this->voiceAssistant->clearHistory();

        return response()->json([
            'success' => true,
            'message' => 'Conversation history cleared.',
        ]);
    }

    /**
     * Generate speech from text.
     */
    public function speak(Request $request): JsonResponse
    {
        $request->validate([
            'text' => 'required|string|max:5000',
        ]);

        try {
            $audioBase64 = $this->voiceAssistant->textToSpeech($request->text);

            if (! $audioBase64) {
                return response()->json([
                    'success' => false,
                    'error' => 'Could not generate speech.',
                ], 500);
            }

            return response()->json([
                'success' => true,
                'audio' => $audioBase64,
            ]);
        } catch (\Exception $e) {
            Log::error('Text-to-speech error', ['message' => $e->getMessage()]);

            return response()->json([
                'success' => false,
                'error' => 'An error occurred while generating speech.',
            ], 500);
        }
    }
}
