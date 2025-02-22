import { NPCProfession } from './npc';
import { ResourceType } from './resources';

export enum ActionType {
	MOVE = 'move',
	SPEAK = 'speak',
	ATTACK = 'attack',
	FOLLOW = 'follow',
	STOP = 'stop',
	RUN = 'run',
	WALK = 'walk',
}

export enum TargetType {
	LOCATION = 'location',
	NPC = 'npc',
	RESOURCE = 'resource',
	PLAYER = 'player',
}

export interface CommandTarget {
	type: TargetType;
	// For locations
	x?: number;
	z?: number;
	// For NPCs
	npcName?: string;
	profession?: NPCProfession;
	// For resources
	resourceType?: ResourceType;
	// Common
	nearest?: boolean;
	furthest?: boolean;
}

export interface Command {
	targetNpcName: string; // The NPC receiving the command
	action: ActionType; // What to do
	target?: CommandTarget; // Where/what/who to do it to
	message?: string; // For speak commands
	modifier?: string; // Additional qualifiers (e.g., "quickly", "slowly")
}

export interface CommandValidationError {
	field: string;
	message: string;
}

export interface CommandResult {
	success: boolean;
	command: Command;
	errors?: CommandValidationError[];
	message?: string;
	executionId?: string;
}

export interface CommandExecutionState {
	id: string;
	command: Command;
	status: 'pending' | 'executing' | 'completed' | 'failed';
	startTime: number;
	endTime?: number;
	error?: string;
}

// Command validation functions
export function validateCommand(command: Command): CommandValidationError[] {
	const errors: CommandValidationError[] = [];

	// Check required fields
	if (!command.targetNpcName) {
		errors.push({ field: 'targetNpcName', message: 'NPC name is required' });
	}
	if (!command.action) {
		errors.push({ field: 'action', message: 'Action is required' });
	}

	// Validate action-specific requirements
	switch (command.action) {
		case ActionType.SPEAK:
			if (!command.message) {
				errors.push({
					field: 'message',
					message: 'Message is required for speak action',
				});
			}
			break;

		case ActionType.MOVE:
		case ActionType.RUN:
		case ActionType.WALK:
			if (!command.target) {
				errors.push({
					field: 'target',
					message: 'Target is required for movement actions',
				});
			} else if (command.target.type === TargetType.LOCATION) {
				if (
					typeof command.target.x !== 'number' ||
					typeof command.target.z !== 'number'
				) {
					errors.push({
						field: 'target',
						message: 'Location coordinates (x,z) are required',
					});
				}
			}
			break;

		case ActionType.ATTACK:
		case ActionType.FOLLOW:
			if (!command.target) {
				errors.push({
					field: 'target',
					message: 'Target is required for attack/follow actions',
				});
			}
			break;
	}

	return errors;
}
