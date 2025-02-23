// Move interface outside the module
export interface NPCNameInfo {
	fullName: string;
	firstName: string;
	lastName: string;
	isFemale: boolean;
	voiceId: string;
}

export module NameGenerator {
	// Female and male voice ID arrays (to be populated)
	export const FEMALE_VOICE_IDS: string[] = [
		'esy0r39YPLQjOczyOib8',
		'c8GqgOMlDjKmhWVDfhvI',
		'Se2Vw1WbHmGbBbyWTuu4',
	];

	export const MALE_VOICE_IDS: string[] = [
		'loO7Gy3kpLlZJiTYPH8n',
		'stwMUa9lNiROnfFgg9AP',
		'2KQQugeCbzK3DlEDAYh6',
		'QCN66Z6lqVsb2asfrURf',
	];

	// Separate first names by gender for better voice matching
	export const FEMALE_FIRST_NAMES = [
		'Mary',
		'Emma',
		'Sarah',
		'Elizabeth',
		'Margaret',
		'Alice',
		'Catherine',
		'Anne',
		'Jane',
		'Eleanor',
	];

	export const MALE_FIRST_NAMES = [
		'John',
		'William',
		'Thomas',
		'James',
		'Robert',
		'Henry',
		'Edward',
		'Richard',
		'George',
		'Charles',
	];

	export const GUARD_FEMALE_NAMES = [
		'Victoria',
		'Valeria',
		'Julia',
		'Lucia',
		'Augusta',
		'Claudia',
		'Flavia',
		'Helena',
		'Livia',
	];

	export const GUARD_MALE_NAMES = [
		'Marcus',
		'Victor',
		'Magnus',
		'Brutus',
		'Julius',
		'Maximus',
		'Felix',
		'Lucius',
		'Cassius',
		'Augustus',
	];

	export const LAST_NAMES = [
		'Smith',
		'Miller',
		'Baker',
		'Fisher',
		'Cooper',
		'Fletcher',
		'Wright',
		'Carter',
		'Mason',
		'Potter',
		'Turner',
		'Walker',
		'Hunter',
		'Archer',
		'Thatcher',
	];

	export function generateRandomName(
		profession: 'Guard' | 'Villager'
	): NPCNameInfo {
		// Determine if this NPC will be female (50% chance)
		const isFemale = Math.random() < 0.5;

		// Get appropriate name lists based on profession and gender
		const firstNames =
			profession === 'Guard'
				? isFemale
					? GUARD_FEMALE_NAMES
					: GUARD_MALE_NAMES
				: isFemale
				? FEMALE_FIRST_NAMES
				: MALE_FIRST_NAMES;

		// Select random names
		const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
		const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];

		// Select a random voice ID based on gender
		const voiceIds = isFemale ? FEMALE_VOICE_IDS : MALE_VOICE_IDS;
		const voiceId =
			voiceIds.length > 0
				? voiceIds[Math.floor(Math.random() * voiceIds.length)]
				: '2KQQugeCbzK3DlEDAYh6'; // Default voice ID if none are set

		return {
			fullName: `${firstName} ${lastName}`,
			firstName,
			lastName,
			isFemale,
			voiceId,
		};
	}
}
