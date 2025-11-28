/**
 * Configuration object defining resources and their available actions.
 * Keys are resource names, and values are arrays of action strings.
 * Use `as const` to ensure literal types are preserved.
 */
export type AccessControlConfig = Record<string, readonly string[]>;

/**
 * A single statement in an access control policy.
 * Defines a permission for a specific resource and actions.
 */
export type TAccessControlStatement<T extends AccessControlConfig> = {
	[R in keyof T]: {
		/** The resource this statement applies to. */
		resource: R;
		/** The actions allowed or denied. Can include '*' for all actions. */
		actions: readonly (T[R][number] | "*" | "")[];
		/** The effect of the statement: 'allow' grants access, 'deny' blocks it. */
		effect: "allow" | "deny";
		/** Optional conditions for Attribute-Based Access Control (ABAC). Access is granted if ANY condition object matches (OR logic). */
		// biome-ignore lint/suspicious/noExplicitAny: Conditions can have any value type
		context_conditions?: Record<string, any>[];
	};
}[keyof T];

/**
 * An access control policy consisting of an array of statements.
 */
export type TAccessControlPolicy<T extends AccessControlConfig> =
	readonly TAccessControlStatement<T>[];

/**
 * The context value provided by AccessPolicyProvider.
 * Contains the policy and helper functions for checking permissions.
 */
export interface AccessPolicyContextType<T extends AccessControlConfig> {
	/** The current access control policy. */
	policy: TAccessControlPolicy<T>;
	/** Checks if a specific action on a resource is allowed. */
	can: <R extends keyof T>(
		resource: R,
		action: T[R][number],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
	) => boolean;
	/** Checks if ALL specified actions on a resource are allowed. */
	canAll: <R extends keyof T>(
		resource: R,
		actions: T[R][number][],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
	) => boolean;
	/** Checks if ANY of the specified actions on a resource are allowed. */
	canAny: <R extends keyof T>(
		resource: R,
		actions: T[R][number][],
		// biome-ignore lint/suspicious/noExplicitAny: Context can have any value type
		context?: Record<string, any> | Record<string, any>[],
	) => boolean;
}
