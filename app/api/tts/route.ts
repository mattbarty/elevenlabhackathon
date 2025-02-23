import { NextResponse } from 'next/server';
import { ElevenLabsClient } from 'elevenlabs';
import { Readable } from 'stream';

// Initialize ElevenLabs client
const client = new ElevenLabsClient({
	apiKey: process.env.ELEVENLABS_API_KEY,
});

// Default voice IDs
const DEFAULT_MALE_VOICE = '2KQQugeCbzK3DlEDAYh6';
const DEFAULT_FEMALE_VOICE = 'EXAVITQu4vr4xnSDxMaL';

// Helper function to convert stream to buffer
async function streamToBuffer(stream: Readable): Promise<Buffer> {
	const chunks: Buffer[] = [];
	for await (const chunk of stream) {
		chunks.push(Buffer.from(chunk));
	}
	return Buffer.concat(chunks);
}

export async function POST(request: Request) {
	try {
		const { text, voiceId, isFemale } = await request.json();

		if (!text) {
			return NextResponse.json({ error: 'Text is required' }, { status: 400 });
		}

		// Use provided voiceId, or fall back to default based on gender
		const finalVoiceId =
			voiceId || (isFemale ? DEFAULT_FEMALE_VOICE : DEFAULT_MALE_VOICE);

		// Convert text to speech using ElevenLabs
		const audioStream = await client.textToSpeech.convert(finalVoiceId, {
			output_format: 'mp3_44100_128',
			text: text,
			model_id: 'eleven_multilingual_v2',
		});

		// Convert stream to buffer
		const audioBuffer = await streamToBuffer(audioStream);

		// Convert Buffer to Base64
		const base64Audio = audioBuffer.toString('base64');

		return NextResponse.json({
			audio: base64Audio,
			format: 'mp3',
		});
	} catch (error) {
		console.error('Text-to-speech error:', error);
		return NextResponse.json(
			{ error: 'Failed to convert text to speech' },
			{ status: 500 }
		);
	}
}
