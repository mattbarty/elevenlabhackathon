import { NextResponse } from 'next/server';
import {
	CommandContext,
	GPTResponse,
	NPC_COMMAND_FUNCTIONS,
} from '@/app/game/types/ai';
import { Command, ActionType, TargetType } from '@/app/game/types/commands';
import OpenAI from 'openai';

const openai = new OpenAI({
	apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: Request) {
	try {
		console.log('📥 Received command interpretation request');
		const { command, context } = await request.json();
		console.log('🗣️ Command:', command);
		console.log('📊 Context:', {
			npcState: context.npcState,
			nearbyNPCs: context.nearbyNPCs.length,
			nearbyResources: context.nearbyResources.length,
			completedSteps: context.completedSteps.length,
		});

		// Split command into steps
		const steps = command.toLowerCase().split(/\s+then\s+/);
		console.log('📝 Command steps:', steps);

		const commands: Command[] = [];
		for (const step of steps) {
			const messages = [
				{
					role: 'system' as const,
					content: `You are a command interpreter for a medieval fantasy RPG game.
                    Your task is to convert natural language commands into executable game commands.
                    Consider the current state of the NPC and the game world when planning actions.
                    Available commands are provided in the functions list.
                    IMPORTANT: You must ALWAYS call exactly one function to execute the command.
                    
                    When interpreting commands:
                    1. Consider the NPC's profession and current state
                    2. Use running speed when urgency is implied or during combat
                    3. Make NPCs speak naturally based on their profession (guards more formal, villagers more casual)
                    4. For combat, ensure the NPC is in range before attacking
                    5. For movement, use reasonable coordinates within the game world`,
				},
				{
					role: 'user' as const,
					content: `Current context:
                    NPC State: ${JSON.stringify(context.npcState)}
                    Player Position: ${JSON.stringify(context.playerPosition)}
                    Nearby NPCs: ${JSON.stringify(context.nearbyNPCs)}
                    Nearby Resources: ${JSON.stringify(context.nearbyResources)}
                    Completed Steps: ${JSON.stringify(context.completedSteps)}
                    
                    Command: ${step}`,
				},
			];

			console.log('🤖 Calling GPT API for step:', step);
			const response = await openai.chat.completions.create({
				model: 'gpt-4o-mini',
				messages,
				functions: NPC_COMMAND_FUNCTIONS,
				function_call: 'auto',
				temperature: 0.7,
				max_tokens: 500,
			});

			const message = response.choices[0]?.message;
			const functionCall = message?.function_call;

			if (functionCall) {
				try {
					const parsedArguments = JSON.parse(functionCall.arguments || '{}');
					let command: Command = {
						targetNpcName: context.npcState.name,
						action: ActionType.SPEAK,
						message: '',
					};

					// Convert GPT function call to game command
					switch (functionCall.name) {
						case 'moveToLocation':
							command = {
								targetNpcName: context.npcState.name,
								action: parsedArguments.running
									? ActionType.RUN
									: ActionType.WALK,
								target: {
									type: TargetType.LOCATION,
									x: parsedArguments.x,
									z: parsedArguments.z,
								},
							};
							break;

						case 'speak':
							command = {
								targetNpcName: context.npcState.name,
								action: ActionType.SPEAK,
								message: parsedArguments.message,
							};
							break;

						case 'attack':
							command = {
								targetNpcName: context.npcState.name,
								action: ActionType.ATTACK,
								target: {
									type: TargetType.NPC,
									npcName: parsedArguments.targetName,
								},
							};
							break;

						case 'follow':
							command = {
								targetNpcName: context.npcState.name,
								action: ActionType.FOLLOW,
								target: {
									type: TargetType.NPC,
									npcName: parsedArguments.targetName,
								},
							};
							break;

						case 'stop':
							command = {
								targetNpcName: context.npcState.name,
								action: ActionType.STOP,
							};
							break;
					}

					commands.push(command);
				} catch (e) {
					console.error(
						'❌ Error parsing function arguments for step:',
						step,
						e
					);
					throw new Error('Invalid function arguments');
				}
			} else {
				console.warn('⚠️ No function call in response for step:', step);
				throw new Error('GPT response missing required function call');
			}
		}

		const gptResponse: GPTResponse = {
			commands,
			explanation: 'Commands processed successfully',
		};

		console.log('📤 Sending response:', gptResponse);
		return NextResponse.json(gptResponse);
	} catch (error) {
		console.error('❌ Error in GPT API:', error);
		return NextResponse.json(
			{ error: 'Failed to process command' },
			{ status: 500 }
		);
	}
}
