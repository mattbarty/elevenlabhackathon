import { Entity } from '../core/Entity';

export interface ConversationContext {
	isInConversation: boolean;
	conversationTarget?: Entity;
	contextMemory: {
		playerName?: string;
		knownFacts: Map<string, any>;
		lastInteraction: number;
		conversationHistory: Array<{
			speaker: 'player' | 'npc';
			message: string;
			timestamp: number;
		}>;
	};
	conversationState: 'idle' | 'talking' | 'listening' | 'processing';
}

export interface DialogueResponse {
	type: 'chat' | 'instruction';
	content: string;
	instruction?: {
		action: string;
		parameters: any;
	};
	contextUpdates?: {
		key: string;
		value: any;
	}[];
}

export interface NPCDialogueConfig {
	personality?: string;
	knownFacts?: Record<string, any>;
	defaultResponses?: {
		greeting?: string[];
		farewell?: string[];
		confused?: string[];
		busy?: string[];
	};
	voiceId?: string;
}
