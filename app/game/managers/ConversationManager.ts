import { Entity } from '../core/Entity';
import { NPCEntity } from '../entities/NPCEntity';
import {
	ConversationContext,
	DialogueResponse,
	NPCDialogueConfig,
} from '../types/dialogue';
import * as THREE from 'three';

export class ConversationManager {
	private npc: NPCEntity;
	private context: ConversationContext;
	private config: NPCDialogueConfig;
	private static readonly CONVERSATION_TIMEOUT = 30000; // 30 seconds

	constructor(npc: NPCEntity, config: NPCDialogueConfig = {}) {
		this.npc = npc;
		this.config = config;
		this.context = {
			isInConversation: false,
			contextMemory: {
				knownFacts: new Map(Object.entries(config.knownFacts || {})),
				lastInteraction: 0,
				conversationHistory: [],
			},
			conversationState: 'idle',
		};
	}

	public async processInput(input: string, speaker: Entity): Promise<void> {
		// Update conversation state
		const now = Date.now();
		const timeSinceLastInteraction =
			now - this.context.contextMemory.lastInteraction;

		// Check if this is a new conversation
		if (
			!this.context.isInConversation ||
			timeSinceLastInteraction > ConversationManager.CONVERSATION_TIMEOUT
		) {
			this.startNewConversation(speaker);
		}

		// Update context
		this.context.contextMemory.lastInteraction = now;
		this.context.conversationState = 'processing';
		this.context.conversationTarget = speaker;

		// Add to conversation history
		this.context.contextMemory.conversationHistory.push({
			speaker: 'player',
			message: input,
			timestamp: now,
		});

		try {
			// Get response from API
			const response = await fetch('/api/npc/chat', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					input,
					npcState: {
						name: this.npc.getName(),
						profession: this.npc.getProfession(),
						personality: this.config.personality,
					},
					context: this.context,
				}),
			});

			const dialogueResponse: DialogueResponse = await response.json();

			// Update context with any new information
			if (dialogueResponse.contextUpdates) {
				dialogueResponse.contextUpdates.forEach((update) => {
					this.context.contextMemory.knownFacts.set(update.key, update.value);
				});
			}

			// Handle the response
			if (dialogueResponse.type === 'chat') {
				// Add NPC's response to history
				this.context.contextMemory.conversationHistory.push({
					speaker: 'npc',
					message: dialogueResponse.content,
					timestamp: Date.now(),
				});

				// Speak the response
				await this.npc.Say(dialogueResponse.content);
			} else if (
				dialogueResponse.type === 'instruction' &&
				dialogueResponse.instruction
			) {
				// Handle instruction (movement, actions, etc.)
				await this.handleInstruction(dialogueResponse.instruction);

				// If there's content to speak along with the instruction, say it
				if (dialogueResponse.content) {
					await this.npc.Say(dialogueResponse.content);
				}
			}

			this.context.conversationState = 'idle';
		} catch (error) {
			console.error('Failed to process conversation:', error);
			this.context.conversationState = 'idle';

			// Use a confused response if available, otherwise a generic one
			const confusedResponse =
				this.config.defaultResponses?.confused?.[0] ||
				"I'm sorry, I didn't quite understand that.";
			await this.npc.Say(confusedResponse);
		}
	}

	private startNewConversation(speaker: Entity): void {
		this.context.isInConversation = true;
		this.context.conversationTarget = speaker;
		this.context.conversationState = 'listening';
		this.context.contextMemory.conversationHistory = [];
	}

	private async handleInstruction(instruction: {
		action: string;
		parameters: any;
	}): Promise<void> {
		switch (instruction.action.toLowerCase()) {
			case 'move':
				if (
					instruction.parameters.x !== undefined &&
					instruction.parameters.z !== undefined
				) {
					this.npc.MoveTo(
						new THREE.Vector3(
							instruction.parameters.x,
							0,
							instruction.parameters.z
						)
					);
				}
				break;
			case 'follow':
				if (this.context.conversationTarget) {
					this.npc.MoveTo(this.context.conversationTarget);
				}
				break;
			case 'stop':
				this.npc.Stop();
				break;
			// Add more instruction handlers as needed
		}
	}

	public endConversation(): void {
		if (this.context.isInConversation) {
			this.context.isInConversation = false;
			this.context.conversationState = 'idle';
			this.context.conversationTarget = undefined;

			// Use a farewell response if available
			if (this.config.defaultResponses?.farewell?.length) {
				const farewell =
					this.config.defaultResponses.farewell[
						Math.floor(
							Math.random() * this.config.defaultResponses.farewell.length
						)
					];
				this.npc.Say(farewell);
			}
		}
	}

	public getContext(): ConversationContext {
		return this.context;
	}

	public isInConversation(): boolean {
		return this.context.isInConversation;
	}

	public getLastInteraction(): number {
		return this.context.contextMemory.lastInteraction;
	}
}
