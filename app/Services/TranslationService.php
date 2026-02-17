<?php

namespace App\Services;

use function Laravel\Ai\agent;

class TranslationService
{
    /**
     * Translate text to multiple languages.
     */
    public function translateToMultiple(string $text, array $languages = ['urdu', 'spanish']): array
    {
        $translations = [
            'english' => $text,
        ];

        foreach ($languages as $language) {
            $translations[$language] = $this->translate($text, $language);
        }

        return $translations;
    }

    /**
     * Translate text to a specific language.
     */
    public function translate(string $text, string $targetLanguage): string
    {
        $languageNames = [
            'urdu' => 'Urdu (اردو)',
            'spanish' => 'Spanish (Español)',
        ];

        $languageName = $languageNames[$targetLanguage] ?? $targetLanguage;

        $response = agent(
            instructions: "You are a translator. Translate text to {$languageName}. Only provide the translation, no explanations.",
            messages: [],
            tools: [],
        )->prompt($text, provider: 'openai', model: 'gpt-4o-mini');

        return (string) $response;
    }
}
