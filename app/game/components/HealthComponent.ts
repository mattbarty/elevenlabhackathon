import { Component } from '../core/Component';

export interface HealthConfig {
	maxHealth: number;
	currentHealth?: number;
}

export class HealthComponent extends Component {
	private maxHealth: number;
	private currentHealth: number;
	private onDeathCallbacks: (() => void)[] = [];

	constructor(config: HealthConfig) {
		super();
		this.maxHealth = config.maxHealth;
		this.currentHealth = config.currentHealth ?? config.maxHealth;
	}

	update(deltaTime: number): void {
		// Health doesn't need regular updates
	}

	damage(amount: number): void {
		this.currentHealth = Math.max(0, this.currentHealth - amount);
		if (this.currentHealth === 0) {
			this.onDeathCallbacks.forEach((callback) => callback());
		}
	}

	heal(amount: number): void {
		this.currentHealth = Math.min(this.maxHealth, this.currentHealth + amount);
	}

	getCurrentHealth(): number {
		return this.currentHealth;
	}

	getMaxHealth(): number {
		return this.maxHealth;
	}

	onDeath(callback: () => void): void {
		this.onDeathCallbacks.push(callback);
	}

	cleanup(): void {
		this.onDeathCallbacks = [];
	}
}
