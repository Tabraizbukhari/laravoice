<?php

use App\Http\Controllers\VoiceAssistantController;
use Illuminate\Support\Facades\Route;
use Inertia\Inertia;
use Laravel\Fortify\Features;

// Route::get('/', function () {
//     return Inertia::render('welcome', [
//         'canRegister' => Features::enabled(Features::registration()),
//     ]);
// })->name('home');

// Route::get('dashboard', function () {
//     return Inertia::render('dashboard');
// })->middleware(['auth', 'verified'])->name('dashboard');

Route::get('/', [VoiceAssistantController::class, 'index'])->name('voice.index');
Route::post('voice/process', [VoiceAssistantController::class, 'process'])->name('voice.process');
Route::post('voice/speak', [VoiceAssistantController::class, 'speak'])->name('voice.speak');
Route::get('voice/history', [VoiceAssistantController::class, 'history'])->name('voice.history');
Route::delete('voice/history', [VoiceAssistantController::class, 'clearHistory'])->name('voice.clear-history');

require __DIR__.'/settings.php';
