<?php

namespace App\Services;

use Illuminate\Support\Collection;
use Illuminate\Support\Facades\File;

class KnowledgeBaseService
{
    private string $docsPath;

    public function __construct()
    {
        $this->docsPath = resource_path('docs');
    }

    /**
     * Load all markdown files from the knowledge base.
     */
    public function loadAllDocuments(): Collection
    {
        if (! File::isDirectory($this->docsPath)) {
            return collect();
        }

        $files = File::files($this->docsPath);

        return collect($files)
            ->filter(fn ($file) => $file->getExtension() === 'md')
            ->map(fn ($file) => [
                'filename' => $file->getFilename(),
                'path' => $file->getPathname(),
                'content' => File::get($file->getPathname()),
            ]);
    }

    /**
     * Get combined knowledge base content for the AI context.
     */
    public function getKnowledgeContext(): string
    {
        $documents = $this->loadAllDocuments();

        if ($documents->isEmpty()) {
            return 'No knowledge base documents available.';
        }

        return $documents
            ->map(fn ($doc) => "--- Document: {$doc['filename']} ---\n{$doc['content']}")
            ->implode("\n\n");
    }

    /**
     * Search for relevant content based on keywords.
     */
    public function searchDocuments(string $query): Collection
    {
        $documents = $this->loadAllDocuments();
        $keywords = $this->extractKeywords($query);

        return $documents
            ->map(function ($doc) use ($keywords) {
                $score = $this->calculateRelevanceScore($doc['content'], $keywords);

                return array_merge($doc, ['relevance_score' => $score]);
            })
            ->filter(fn ($doc) => $doc['relevance_score'] > 0)
            ->sortByDesc('relevance_score');
    }

    /**
     * Extract meaningful keywords from the query.
     */
    private function extractKeywords(string $query): array
    {
        $stopWords = ['who', 'what', 'when', 'where', 'why', 'how', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'about', 'tell', 'me', 'can', 'you', 'please', 'do', 'does', 'did'];

        $words = preg_split('/\s+/', strtolower($query));

        return array_values(array_filter($words, fn ($word) => strlen($word) > 2 && ! in_array($word, $stopWords)));
    }

    /**
     * Calculate relevance score based on keyword matches.
     */
    private function calculateRelevanceScore(string $content, array $keywords): int
    {
        $content = strtolower($content);
        $score = 0;

        foreach ($keywords as $keyword) {
            $score += substr_count($content, $keyword);
        }

        return $score;
    }
}
