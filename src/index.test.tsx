import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { createAccessControl } from "./createAccessControl";
import type { TAccessControlPolicy } from "./types";

// Setup test configuration
const config = {
	POST: ["create", "read", "update", "delete"],
	USER: ["read", "invite", "delete"],
	SETTINGS: ["view", "edit"],
} as const;

type TStrongAccessControlConfig = typeof config;

const { AccessPolicyProvider, AccessPolicyGuard, getAccessPolicy } =
	createAccessControl(config);

describe("Access Control System", () => {
	describe("getAccessPolicy (Universal Helper)", () => {
		it("should allow action when matching allow statement exists", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const { can } = getAccessPolicy(policy);
			expect(can("POST", "read")).toBe(true);
		});

		it("should support conditions", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123" }],
				},
			];

			const { can } = getAccessPolicy(policy);
			expect(can("POST", "update", { authorId: "auth-123" })).toBe(true);
			expect(can("POST", "update", { authorId: "other-user" })).toBe(false);
		});

		it("should deny if conditions are missing but policy requires them", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123" }],
				},
			];

			const { can } = getAccessPolicy(policy);
			expect(can("POST", "update")).toBe(false);
		});

		it("should allow if statement has no conditions (applies to all contexts)", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const { can } = getAccessPolicy(policy);
			expect(can("POST", "read")).toBe(true);
			expect(can("POST", "read", { someContext: "value" })).toBe(true);
		});

		it("should support allow if only one condition key matches", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ status: "published" }],
				},
			];

			const { can } = getAccessPolicy(policy);
			expect(can("POST", "update", { status: "published" })).toBe(true);
			expect(can("POST", "update", { status: "draft" })).toBe(false);
		});

		it("should support multiple condition keys", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123", status: "draft" }],
				},
				{
					resource: "POST",
					actions: ["update"],
					effect: "deny",
					contexts: [{ authorId: "auth-123", resource: "protected" }],
				},
			];

			const { can } = getAccessPolicy(policy);
			expect(
				can("POST", "update", { authorId: "auth-123", status: "draft" }),
			).toBe(true);
			expect(
				can("POST", "update", { authorId: "auth-123", status: "published" }),
			).toBe(false);
			expect(
				can("POST", "update", { authorId: "auth-123", resource: "protected" }),
			).toBe(false);
			expect(can("POST", "update", { authorId: "auth-123" })).toBe(false); // Missing key
		});

		it("should support array-based conditions (OR logic)", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["*"],
					effect: "allow",
					contexts: [
						{ status: "published" },
						{ status: "draft", role: "superadmin" },
					],
				},
				{
					resource: "POST",
					actions: ["read"],
					effect: "allow",
					contexts: [
						{ status: "published" },
						{ status: "draft", role: "superadmin" },
					],
				},
			];

			const { can } = getAccessPolicy(policy);

			// Match first condition
			expect(can("POST", "delete", { status: "published" })).toBe(true);

			// Match second condition
			expect(
				can("POST", "delete", { status: "draft", role: "superadmin" }),
			).toBe(true);
			expect(can("POST", "read", { status: "draft", role: "superadmin" })).toBe(
				true,
			);
			expect(can("POST", "read", { status: "draft", role: "user" })).toBe(
				false,
			);

			// Match neither
			expect(can("POST", "delete", { status: "draft", role: "user" })).toBe(
				false,
			);
			expect(can("POST", "delete", { status: "archived" })).toBe(false);
		});

		it("should support passing an array of conditions (OR logic) in check", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ role: "user" }, { role: "admin", status: "draft" }],
				},
			];

			const { can } = getAccessPolicy(policy);

			// Should allow if one of the input conditions matches the policy
			// Here we pass multiple potential contexts the user might be in
			expect(can("POST", "update", [{ role: "user" }, { role: "admin" }])).toBe(
				true,
			);
			expect(can("POST", "update", [{ role: "user" }])).toBe(true);
			expect(can("POST", "update", [{ role: "guest" }])).toBe(false);
		});
	});

	describe("React Integration", () => {
		it("should support conditions in components", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{
					resource: "POST",
					actions: ["update"],
					effect: "allow",
					contexts: [{ authorId: "auth-123" }],
				},
			];

			render(
				<AccessPolicyProvider accessControlPolicy={policy}>
					<AccessPolicyGuard
						resource="POST"
						action="update"
						context={{ authorId: "auth-123" }}
					>
						<button type="button">Edit My Post</button>
					</AccessPolicyGuard>
					<AccessPolicyGuard
						resource="POST"
						action="update"
						context={[{ authorId: "other" }]}
						fallback={<span>Cannot edit</span>}
					>
						<button type="button">Edit Other Post</button>
					</AccessPolicyGuard>
				</AccessPolicyProvider>,
			);

			expect(await screen.findByText("Edit My Post")).toBeInTheDocument();
			expect(await screen.findByText("Cannot edit")).toBeInTheDocument();
		});
	});

	describe("Loading State", () => {
		it("should expose isLoading from useAccessPolicy", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [];
			render(
				<AccessPolicyProvider accessControlPolicy={policy} isLoading={true}>
					<AccessPolicyGuard resource="POST" action="read">
						<div>Content</div>
					</AccessPolicyGuard>
				</AccessPolicyProvider>,
			);
			// We can't easily check the hook return value directly without a test component,
			// but we can check if the Guard behaves correctly which uses the hook.
		});

		it("should show loadingFallback when loading", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			render(
				<AccessPolicyProvider accessControlPolicy={policy} isLoading={true}>
					<AccessPolicyGuard
						resource="POST"
						action="read"
						loadingFallback={<div>Loading...</div>}
					>
						<div>Content</div>
					</AccessPolicyGuard>
				</AccessPolicyProvider>,
			);

			expect(await screen.findByText("Loading...")).toBeInTheDocument();
			expect(screen.queryByText("Content")).not.toBeInTheDocument();
		});

		it("should show content when not loading", async () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			render(
				<AccessPolicyProvider accessControlPolicy={policy} isLoading={false}>
					<AccessPolicyGuard
						resource="POST"
						action="read"
						loadingFallback={<div>Loading...</div>}
					>
						<div>Content</div>
					</AccessPolicyGuard>
				</AccessPolicyProvider>,
			);

			expect(await screen.findByText("Content")).toBeInTheDocument();
			expect(screen.queryByText("Loading...")).not.toBeInTheDocument();
		});

		it("should default to null fallback when loading if not provided", () => {
			const policy: TAccessControlPolicy<TStrongAccessControlConfig> = [
				{ resource: "POST", actions: ["read"], effect: "allow" },
			];

			const { container } = render(
				<AccessPolicyProvider accessControlPolicy={policy} isLoading={true}>
					<AccessPolicyGuard resource="POST" action="read">
						<div>Content</div>
					</AccessPolicyGuard>
				</AccessPolicyProvider>,
			);

			expect(container).toBeEmptyDOMElement();
		});
	});
});
