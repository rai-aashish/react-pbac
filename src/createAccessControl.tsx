import type React from "react";
import { createContext, useContext, useMemo } from "react";
import type {
	AccessControlConfig,
	AccessPolicyContextType,
	TAccessControlPolicy,
} from "./types";

/**
 * Props for the AccessPolicyProvider component.
 */
export interface AccessPolicyProviderProps<T extends AccessControlConfig> {
	/** The access control policy to enforce. */
	accessControlPolicy: TAccessControlPolicy<T>;
	children: React.ReactNode;
}

/**
 * Props for the AccessPolicyGuard component.
 */
export interface AccessPolicyGuardProps<
	T extends AccessControlConfig,
	R extends keyof T,
> {
	/** The resource to check access for. */
	resource: R;
	/** The action to check access for. */
	action: T[R][number];
	/** Optional conditions to check against the policy. */
	// biome-ignore lint/suspicious/noExplicitAny: Conditions can have any value type
	conditions?: Record<string, any> | Record<string, any>[];
	/** Content to render if access is denied. Defaults to null. */
	fallback?: React.ReactNode;
	children: React.ReactNode;
}

/**
 * Factory function to create typed access control utilities based on your configuration.
 *
 * @param config - The configuration object defining resources and actions.
 * @returns An object containing the Provider, hooks, and components typed to your config.
 */
export function createAccessControl<T extends AccessControlConfig>(_config: T) {
	const AccessPolicyContext = createContext<
		AccessPolicyContextType<T> | undefined
	>(undefined);

	/**
	 * Helper to evaluate the policy against a resource, action, and conditions.
	 * Can be used in non-React environments (e.g., Server Components, API routes).
	 *
	 * @param accessControlPolicy - The policy to evaluate.
	 * @returns An object containing `can`, `canAll`, and `canAny` functions.
	 */
	const getAccessPolicy = (accessControlPolicy: TAccessControlPolicy<T>) => {
		const can = <R extends keyof T>(
			resource: R,
			action: T[R][number],
			// biome-ignore lint/suspicious/noExplicitAny: Conditions can have any value type
			conditions?: Record<string, any> | Record<string, any>[],
		): boolean => {
			let isAllowed = false;

			// Normalize input conditions to an array
			const inputConditions = Array.isArray(conditions)
				? conditions
				: conditions
					? [conditions]
					: [];

			// Filter statements relevant to this resource
			const relevantStatements = accessControlPolicy.filter(
				(stmt) => stmt.resource === resource,
			);

			for (const stmt of relevantStatements) {
				// Check if action matches or is wildcard
				const actionMatches =
					stmt.actions.includes("*") || stmt.actions.includes(action);
				if (!actionMatches) continue;

				// Check conditions
				let conditionMatches = true;
				const policyConditions = stmt.conditions || [];

				if (policyConditions.length > 0) {
					if (inputConditions.length === 0) {
						// If statement has conditions but no input conditions provided, it doesn't match
						conditionMatches = false;
					} else {
						// Check if ANY policy condition matches ANY input condition (OR logic)
						// We need to find at least one pair of (policyCondition, inputCondition) that matches
						const anyMatch = policyConditions.some((policyCondition) => {
							return inputConditions.some((inputCondition) => {
								// Check if ALL keys in the policy condition match the input condition values
								return Object.entries(policyCondition).every(
									([key, value]) => inputCondition[key] === value,
								);
							});
						});

						if (!anyMatch) {
							conditionMatches = false;
						}
					}
				}

				if (!conditionMatches) continue;

				if (stmt.effect === "deny") {
					return false; // Explicit deny overrides everything
				}

				if (stmt.effect === "allow") {
					isAllowed = true;
				}
			}

			return isAllowed;
		};

		const canAll = <R extends keyof T>(
			resource: R,
			actions: T[R][number][],
			// biome-ignore lint/suspicious/noExplicitAny: Conditions can have any value type
			conditions?: Record<string, any> | Record<string, any>[],
		): boolean => {
			return actions.every((action) => can(resource, action, conditions));
		};

		const canAny = <R extends keyof T>(
			resource: R,
			actions: T[R][number][],
			// biome-ignore lint/suspicious/noExplicitAny: Conditions can have any value type
			conditions?: Record<string, any> | Record<string, any>[],
		): boolean => {
			return actions.some((action) => can(resource, action, conditions));
		};

		return { policy: accessControlPolicy, can, canAll, canAny };
	};

	/**
	 * Context Provider component. Wraps your application or subtree to provide the access policy.
	 */
	const AccessPolicyProvider: React.FC<AccessPolicyProviderProps<T>> = ({
		accessControlPolicy,
		children,
	}) => {
		const value = useMemo(
			() => getAccessPolicy(accessControlPolicy),
			[accessControlPolicy],
		);
		return (
			<AccessPolicyContext.Provider value={value}>
				{children}
			</AccessPolicyContext.Provider>
		);
	};

	/**
	 * Hook to access the access control context.
	 *
	 * @returns The access control context containing `can`, `canAll`, `canAny`, and `policy`.
	 * @throws Error if used outside of AccessPolicyProvider.
	 */
	const useAccessPolicy = () => {
		const context = useContext(AccessPolicyContext);
		if (context === undefined) {
			throw new Error(
				"useAccessPolicy must be used within an AccessPolicyProvider",
			);
		}
		return context;
	};

	/**
	 * Component that conditionally renders its children based on access control.
	 */
	const AccessPolicyGuard = <R extends keyof T>({
		resource,
		action,
		conditions,
		fallback = null,
		children,
	}: AccessPolicyGuardProps<T, R>) => {
		const { can } = useAccessPolicy();

		if (can(resource, action, conditions)) {
			return <>{children}</>;
		}

		return <>{fallback}</>;
	};

	/**
	 * Higher-Order Component (HOC) to protect a component with access control.
	 *
	 * @param WrappedComponent - The component to wrap.
	 * @param resource - The resource to check.
	 * @param action - The action to check.
	 * @param conditions - Optional conditions to check.
	 * @param FallbackComponent - Optional component to render if access is denied.
	 * @returns A new component that checks access before rendering the wrapped component.
	 */
	const withAccessPolicy = <P extends object, R extends keyof T>(
		WrappedComponent: React.ComponentType<P>,
		resource: R,
		action: T[R][number],
		// biome-ignore lint/suspicious/noExplicitAny: Conditions can have any value type
		conditions?: Record<string, any> | Record<string, any>[],
		FallbackComponent: React.ComponentType<P> | null = null,
	) => {
		return (props: P) => {
			const { can } = useAccessPolicy();

			if (can(resource, action, conditions)) {
				return <WrappedComponent {...props} />;
			}

			if (FallbackComponent) {
				return <FallbackComponent {...props} />;
			}

			return null;
		};
	};

	return {
		AccessPolicyProvider,
		useAccessPolicy,
		AccessPolicyGuard,
		withAccessPolicy,
		getAccessPolicy,
	};
}
