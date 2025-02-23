import { NextResponse } from 'next/server';
import {
	ConversationContext,
	DialogueResponse,
} from '@/app/game/types/dialogue';

interface ChatRequest {
	input: string;
	npcState: {
		name: string;
		profession: string;
		personality?: string;
	};
	context: ConversationContext;
}

export async function POST(request: Request) {
	try {
		const body: ChatRequest = await request.json();
		const { input, npcState, context } = body;

		// Construct the prompt for the NPC
		const prompt = `You are ${npcState.name}, a ${npcState.profession} ${
			npcState.personality ? `with a ${npcState.personality} personality` : ''
		} in a medieval fantasy game.
    
Previous conversation:
${context.contextMemory.conversationHistory
	.map((msg) => `${msg.speaker}: ${msg.message}`)
	.join('\n')}

Known facts about you:
${Array.from(context.contextMemory.knownFacts.entries())
	.map(([key, value]) => `- ${key}: ${value}`)
	.join('\n')}

Player says: "${input}"

Respond in character, keeping your responses concise and natural. You can also include instructions for actions like moving or following the player.
Format your response as either:
1. A chat response: { type: 'chat', content: 'your message' }
2. An instruction with optional speech: { type: 'instruction', instruction: { action: 'move|follow|stop', parameters: {...} }, content?: 'what to say while acting' }`;

		// Call OpenAI API
		const response = await fetch('https://api.openai.com/v1/chat/completions', {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
			},
			body: JSON.stringify({
				model: 'gpt-4-turbo-preview',
				messages: [
					{
						role: 'system',
						content: prompt,
					},
				],
				temperature: 0.7,
				max_tokens: 150,
			}),
		});

		if (!response.ok) {
			throw new Error('Failed to get response from OpenAI API');
		}

		const aiResponse = await response.json();
		const dialogueResponse: DialogueResponse = JSON.parse(
			aiResponse.choices[0].message.content
		);

		// Validate the response format
		if (
			!dialogueResponse.type ||
			!['chat', 'instruction'].includes(dialogueResponse.type)
		) {
			throw new Error('Invalid response format from AI');
		}

		return NextResponse.json(dialogueResponse);
	} catch (error) {
		console.error('Error in NPC chat endpoint:', error);
		return NextResponse.json(
			{ type: 'chat', content: "I'm having trouble understanding right now." },
			{ status: 500 }
		);
	}
}
