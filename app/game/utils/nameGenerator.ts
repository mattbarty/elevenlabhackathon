export module NameGenerator {
	export const VILLAGER_FIRST_NAMES = [
		'John',
		'Mary',
		'William',
		'Emma',
		'Thomas',
		'Sarah',
		'James',
		'Elizabeth',
		'Robert',
		'Margaret',
		'Henry',
		'Alice',
		'Edward',
		'Catherine',
		'Richard',
		'Anne',
		'George',
		'Jane',
		'Charles',
		'Eleanor',
	];

	export const GUARD_FIRST_NAMES = [
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
		'Claudius',
		'Titus',
		'Rufus',
		'Quintus',
		'Gaius',
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

	export function generateRandomName(profession: 'Guard' | 'Villager'): string {
		const firstNames =
			profession === 'Guard' ? GUARD_FIRST_NAMES : VILLAGER_FIRST_NAMES;
		const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
		const lastName = LAST_NAMES[Math.floor(Math.random() * LAST_NAMES.length)];
		return `${firstName} ${lastName}`;
	}
}
