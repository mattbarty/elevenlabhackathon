import { NextResponse } from 'next/server';
import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
	try {
		const formData = await request.formData();
		const audioFile = formData.get('audio') as File;

		if (!audioFile) {
			return NextResponse.json(
				{ error: 'No audio file provided' },
				{ status: 400 }
			);
		}

		// Convert File to Buffer
		const arrayBuffer = await audioFile.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);

		// Transcribe using Whisper API
		const transcription = await openai.audio.transcriptions.create({
			file: new File([buffer], 'audio.webm', { type: 'audio/webm' }),
			model: 'whisper-1',
			language: 'en',
		});

		return NextResponse.json({ text: transcription.text });
	} catch (error) {
		console.error('Transcription error:', error);
		return NextResponse.json(
			{ error: 'Failed to transcribe audio' },
			{ status: 500 }
		);
	}
}
