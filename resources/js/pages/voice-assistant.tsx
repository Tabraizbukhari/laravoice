import { Head } from '@inertiajs/react';
import { useCallback, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface TranslatedText {
    english: string;
    urdu: string;
    spanish: string;
}

interface AssistantResponse {
    success: boolean;
    query?: TranslatedText;
    response?: TranslatedText;
    audio?: string;
    error?: string;
}

export default function VoiceAssistant() {
    const [isRecording, setIsRecording] = useState(false);
    const [isProcessing, setIsProcessing] = useState(false);
    const [query, setQuery] = useState<TranslatedText | null>(null);
    const [response, setResponse] = useState<TranslatedText | null>(null);
    const [error, setError] = useState<string | null>(null);
    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const audioRef = useRef<HTMLAudioElement | null>(null);

    const getSupportedMimeType = (): string => {
        const mimeTypes = [
            'audio/webm;codecs=opus',
            'audio/webm',
            'audio/ogg;codecs=opus',
            'audio/mp4',
            'audio/mpeg',
        ];
        for (const mimeType of mimeTypes) {
            if (MediaRecorder.isTypeSupported(mimeType)) {
                return mimeType;
            }
        }
        return 'audio/webm';
    };

    const startRecording = useCallback(async () => {
        try {
            setError(null);

            // Check if mediaDevices is available (requires HTTPS or localhost)
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                setError('Microphone access requires HTTPS. Please use localhost or enable HTTPS.');
                return;
            }

            const stream = await navigator.mediaDevices.getUserMedia({
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    sampleRate: 44100,
                }
            });

            const mimeType = getSupportedMimeType();
            const mediaRecorder = new MediaRecorder(stream, { mimeType });
            mediaRecorderRef.current = mediaRecorder;
            audioChunksRef.current = [];

            mediaRecorder.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                }
            };

            mediaRecorder.onstop = async () => {
                const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
                stream.getTracks().forEach(track => track.stop());
                await processAudio(audioBlob);
            };

            mediaRecorder.start();
            setIsRecording(true);
        } catch (err: unknown) {
            const error = err as Error & { name?: string };
            console.error('Microphone access error:', error);

            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setError('Microphone permission denied. Please allow microphone access in your browser settings.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setError('No microphone found. Please connect a microphone and try again.');
            } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
                setError('Microphone is being used by another application. Please close other apps using the microphone.');
            } else if (error.name === 'OverconstrainedError') {
                setError('Microphone does not meet the required constraints.');
            } else if (error.name === 'SecurityError') {
                setError('Microphone access blocked. Please use HTTPS or localhost.');
            } else {
                setError(`Could not access microphone: ${error.message || 'Unknown error'}`);
            }
        }
    }, []);

    const stopRecording = useCallback(() => {
        if (mediaRecorderRef.current && isRecording) {
            mediaRecorderRef.current.stop();
            setIsRecording(false);
        }
    }, [isRecording]);

    const getFileExtension = (mimeType: string): string => {
        if (mimeType.includes('webm')) return 'webm';
        if (mimeType.includes('ogg')) return 'ogg';
        if (mimeType.includes('mp4')) return 'm4a';
        if (mimeType.includes('mpeg')) return 'mp3';
        return 'webm';
    };

    const processAudio = async (audioBlob: Blob) => {
        setIsProcessing(true);
        setError(null);

        const extension = getFileExtension(audioBlob.type);
        const formData = new FormData();
        formData.append('audio', audioBlob, `recording.${extension}`);

        try {
            const response = await fetch('/voice/process', {
                method: 'POST',
                body: formData,
                headers: {
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data: AssistantResponse = await response.json();

            if (data.success) {
                setQuery(data.query || null);
                setResponse(data.response || null);

                if (data.audio) {
                    playAudio(data.audio);
                }
            } else {
                setError(data.error || 'An error occurred');
            }
        } catch (err) {
            setError('Failed to process audio. Please try again.');
            console.error('Processing error:', err);
        } finally {
            setIsProcessing(false);
        }
    };

    const playAudio = (base64Audio: string) => {
        const audio = new Audio(`data:audio/mpeg;base64,${base64Audio}`);
        audioRef.current = audio;
        audio.play().catch(console.error);
    };

    const stopAudio = () => {
        if (audioRef.current) {
            audioRef.current.pause();
            audioRef.current.currentTime = 0;
        }
    };

    const speakText = async (text: string) => {
        try {
            const response = await fetch('/voice/speak', {
                method: 'POST',
                body: JSON.stringify({ text }),
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || '',
                },
            });

            const data = await response.json();
            if (data.success && data.audio) {
                playAudio(data.audio);
            }
        } catch (err) {
            console.error('TTS error:', err);
        }
    };

    return (
        <>
            <Head title="Voice Assistant">
                <meta name="csrf-token" content={document.querySelector('meta[name="csrf-token"]')?.getAttribute('content') || ''} />
            </Head>

            <div className="min-h-screen bg-gradient-to-b from-slate-900 to-slate-800 text-white">
                <div className="container mx-auto max-w-4xl px-4 py-8">
                    {/* Header */}
                    <div className="mb-8 text-center">
                        <h1 className="mb-2 text-4xl font-bold">Voice Assistant</h1>
                        <p className="text-slate-400">Ask questions about Muhammad Tabraiz, Full Stack Web Developer</p>
                    </div>

                    {/* Main Voice Button */}
                    <div className="mb-8 flex flex-col items-center justify-center">
                        <button
                            onClick={isRecording ? stopRecording : startRecording}
                            disabled={isProcessing}
                            className={`relative flex h-32 w-32 items-center justify-center rounded-full transition-all duration-300 ${
                                isRecording
                                    ? 'bg-red-500 shadow-[0_0_60px_rgba(239,68,68,0.5)]'
                                    : isProcessing
                                      ? 'bg-slate-600 cursor-not-allowed'
                                      : 'bg-blue-500 hover:bg-blue-600 hover:shadow-[0_0_40px_rgba(59,130,246,0.5)]'
                            }`}
                        >
                            {isProcessing ? (
                                <svg className="h-12 w-12 animate-spin" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                            ) : isRecording ? (
                                <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                                    <rect x="6" y="6" width="12" height="12" rx="2" />
                                </svg>
                            ) : (
                                <svg className="h-12 w-12" fill="currentColor" viewBox="0 0 24 24">
                                    <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                                    <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
                                </svg>
                            )}

                            {/* Pulse animation when recording */}
                            {isRecording && (
                                <>
                                    <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-30" />
                                    <span className="absolute inset-0 animate-pulse rounded-full bg-red-500 opacity-20" />
                                </>
                            )}
                        </button>

                        <p className="mt-4 text-sm text-slate-400">
                            {isProcessing ? 'Processing...' : isRecording ? 'Listening... Click to stop' : 'Click to start speaking'}
                        </p>
                    </div>

                    {/* Error Message */}
                    {error && (
                        <div className="mb-6 rounded-lg bg-red-500/20 p-4 text-center text-red-300">
                            {error}
                        </div>
                    )}

                    {/* Results */}
                    {(query || response) && (
                        <div className="space-y-6">
                            {/* Query Section */}
                            {query && (
                                <Card className="border-slate-700 bg-slate-800/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg text-slate-300">Your Question</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <LanguageBlock
                                            label="English"
                                            text={query.english}
                                            flag="🇺🇸"
                                            onSpeak={() => speakText(query.english)}
                                        />
                                        {/* Translations commented out - English only
                                        <LanguageBlock
                                            label="Urdu"
                                            text={query.urdu}
                                            flag="🇵🇰"
                                            onSpeak={() => speakText(query.urdu)}
                                            rtl
                                        />
                                        <LanguageBlock
                                            label="Spanish"
                                            text={query.spanish}
                                            flag="🇪🇸"
                                            onSpeak={() => speakText(query.spanish)}
                                        />
                                        */}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Response Section */}
                            {response && (
                                <Card className="border-slate-700 bg-slate-800/50">
                                    <CardHeader className="pb-3">
                                        <CardTitle className="text-lg text-slate-300">Answer</CardTitle>
                                    </CardHeader>
                                    <CardContent className="space-y-4">
                                        <LanguageBlock
                                            label="English"
                                            text={response.english}
                                            flag="🇺🇸"
                                            onSpeak={() => speakText(response.english)}
                                        />
                                        {/* Translations commented out - English only
                                        <LanguageBlock
                                            label="Urdu"
                                            text={response.urdu}
                                            flag="🇵🇰"
                                            onSpeak={() => speakText(response.urdu)}
                                            rtl
                                        />
                                        <LanguageBlock
                                            label="Spanish"
                                            text={response.spanish}
                                            flag="🇪🇸"
                                            onSpeak={() => speakText(response.spanish)}
                                        />
                                        */}
                                    </CardContent>
                                </Card>
                            )}

                            {/* Stop Audio Button */}
                            <div className="flex justify-center">
                                <Button
                                    variant="outline"
                                    onClick={stopAudio}
                                    className="border-slate-600 text-slate-300 hover:bg-slate-700"
                                >
                                    <svg className="mr-2 h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                                        <path d="M6 6h12v12H6z" />
                                    </svg>
                                    Stop Audio
                                </Button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}

interface LanguageBlockProps {
    label: string;
    text: string;
    flag: string;
    rtl?: boolean;
    onSpeak: () => void;
}

function LanguageBlock({ label, text, flag, rtl, onSpeak }: LanguageBlockProps) {
    return (
        <div className="rounded-lg bg-slate-900/50 p-4">
            <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-400">
                    <span>{flag}</span>
                    {label}
                </span>
                <button
                    onClick={onSpeak}
                    className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-700 hover:text-white"
                    title={`Speak in ${label}`}
                >
                    <svg className="h-4 w-4" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02zM14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-.91 7-4.49 7-8.77s-2.99-7.86-7-8.77z" />
                    </svg>
                </button>
            </div>
            <p className={`text-white ${rtl ? 'text-right' : ''}`} dir={rtl ? 'rtl' : 'ltr'}>
                {text}
            </p>
        </div>
    );
}
