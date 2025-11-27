# React Policy Based Access Control (react-pbac)
A powerful, type-safe, and flexible access control library for React and Next.js applications. Define your policies once and get fully typed hooks, components, and utilities for both client and server environments.

## Version

Current Version: **0.1.0**

## License
MIT


## Features

- **🔒 Type-Safe**: Automatic type inference for resources and actions based on your configuration. No manual type definitions or Enums required.
- **📝 Statement-Based Policy**: Granular control with 'allow' and 'deny' effects, similar to AWS IAM.
- **🌍 Universal**: Use the same access control logic in React components, Server Components, and utility functions.
- **🎯 Attribute-Based Access Control (ABAC)**: Support for flexible conditions (e.g., "allow update if authorId matches").
- **🃏 Wildcard Support**: Support for `*` actions (e.g., "allow all actions on USER").
- **🛡️ Secure Defaults**: Default deny policy with explicit allow overrides.

## Installation

```bash
npm install react-pbac
# or
yarn add react-pbac
# or
pnpm add react-pbac
```

## Usage

### 1. Define Configuration

Create a configuration object that defines your resources and available actions. Use `as const` to enable type inference.

```typescript
// access-control.ts
import { createAccessControl } from 'react-pbac';

// Define you configuration in this format
// { RESOURCE_NAME : ARRAY_OF_ACTIONS_FOR_THIS_RESOURCE}
const config = {
  POST: ['create', 'read', 'update', 'delete'],
  USER: ['read', 'invite'],
  SETTINGS: ['view', 'edit'],
} as const;

// Create the typed instance
export const { 
  getAccessPolicy 
  useAccessPolicy, 
  withAccessPolicy,
  AccessPolicyGuard, 
  AccessPolicyProvider, 
} = createAccessControl(config);
```

### 2. Define a Policy

Define your access policy using the statement-based structure. You can use `conditions` to implement ABAC.

```typescript
import { TAccessControlPolicy } from 'react-pbac';

const userPolicy: TAccessControlPolicy<typeof config> = [
  // Allow reading all posts
  {
    resource: 'POST',
    actions: ['read'],
    effect: 'allow',
  },
  // Allow updating only if authorId matches
  {
    resource: 'POST',
    actions: ['update'],
    effect: 'allow',
    conditions: [{ authorId: 'auth-123' }],
  },
  // Explicitly deny deleting posts
  {
    resource: 'POST',
    actions: ['delete'],
    effect: 'deny',
  },
];
```

### 3. Wrap Your App

Wrap your application with the `AccessPolicyProvider` and pass the policy.

```tsx
import { AccessPolicyProvider } from './access-control';

export const App = () => {
// your logic to fetch or prepare the policy
const userAccessPolicy = getUserAccessPolicy();
  return (
    <AccessPolicyProvider accessControlPolicy={userAccessPolicy}>
      <MyComponent />
    </AccessPolicyProvider>
  );
};
```

### 4. Check Permissions (Client-Side)

Use the `useAccessPolicy` hook or `AccessPolicyGuard` component. Pass a `conditions` object (or array of objects) to check against policy conditions.

```tsx
import { useAccessPolicy, AccessPolicyGuard } from './access-control';

const MyComponent = () => {
  const { can } = useAccessPolicy();

  return (
    <div>
      {/* Simple check */}
      {can('POST', 'read') && <button>Read Posts</button>}

      {/* Condition-based check */}
      {can('POST', 'update', { authorId: 'auth-123' }) && <button>Edit My Post</button>}

      {/* Component Guard */}
      <AccessPolicyGuard resource="SETTINGS" action="edit" fallback={<span>No Access</span>}>
        <button>Edit Settings</button>
      </AccessPolicyGuard>
    </div>
  );
};
```

### 5. Check Permissions (Server-Side / Non-React)

Use the `getAccessPolicy` helper to check permissions in Server Components or utility functions.

```typescript
import { getAccessPolicy } from './access-control';

export const checkAccessOnServer = async () => {
  const policy = await fetchUserPolicy(); // Fetch or prepare from backend
  const { can } = getAccessPolicy(policy);

  if (can('POST', 'update', { authorId: 'auth-123' })) {
    // Perform update operation
  }
};
```

## Recipes

### Role-Based Access Control (RBAC)

You can easily implement RBAC by creating a helper function that returns the policy based on a user's role.

```typescript
import { TAccessControlPolicy } from 'react-pbac';
import { config } from './access-control'; // Your config from step 1

type Role = 'ADMIN' | 'EDITOR' | 'VIEWER';

export const getRoleBasedAccessPolicy = (role: Role): TAccessControlPolicy<typeof config> => {
  switch (role) {
    case 'ADMIN':
      return [
        {
          resource: '*',
          actions: ['*'],
          effect: 'allow',
        },
      ];
    case 'EDITOR':
      return [
        {
          resource: 'POST',
          actions: ['create', 'read', 'update'],
          effect: 'allow',
        },
        {
          resource: 'POST',
          actions: ['delete'],
          effect: 'allow',
          conditions: [{ authorId: 'current-user-id' }], // Only delete own posts
        },
      ];
    case 'VIEWER':
      return [
        {
          resource: 'POST',
          actions: ['read'],
          effect: 'allow',
        },
      ];
    default:
      return [];
  }
};

// Usage
const userRole = 'EDITOR';
const policy = getRoleBasedAccessPolicy(userRole);
```

### Attribute-Based Access Control (ABAC)

Combine RBAC with ABAC for fine-grained control. You can pass dynamic conditions to `can` or `AccessPolicyGuard` to match against the policy.

```tsx
// Policy
const policy = [
  {
    resource: 'DOCUMENT',
    actions: ['view'],
    effect: 'allow',
    conditions: [
      { department: 'engineering' },
      { public: true }
    ]
  }
];

// Component
const MyDoc = ({ doc }) => {
  const { can } = useAccessPolicy();
  
  // Checks if doc.department === 'engineering' OR doc.public === true
  if (can('DOCUMENT', 'view', { department: doc.department, public: doc.isPublic })) {
    return <ViewDoc doc={doc} />;
  }
  return null;
};
```

## API Reference

### `createAccessControl(config)`

Factory function to create typed access control utilities.

- **config**: Object mapping resources to arrays of actions.
- **Returns**:
  - `AccessPolicyProvider`: Context provider component.
  - `useAccessPolicy`: Hook to access permissions.
  - `AccessPolicyGuard`: Component to conditionally render children.
  - `withAccessPolicy`: HOC to protect components.
  - `getAccessPolicy`: Helper function for non-React usage.

### `AccessPolicyProvider`

- **Props**:
  - `accessControlPolicy`: Array of policy statements.
  - `children`: React nodes.

### `useAccessPolicy()`

- **Returns**:
  - `can(resource, action, conditions?)`: Returns `boolean`.
  - `canAll(resource, actions, conditions?)`: Returns `boolean`.
  - `canAny(resource, actions, conditions?)`: Returns `boolean`.
  - `policy`: The current policy object.

### `AccessPolicyGuard`

- **Props**:
  - `resource`: Resource key.
  - `action`: Action name.
  - `conditions?`: Optional condition object or array of objects for matching.
  - `fallback?`: Content to show if denied.
  - `children`: Content to show if allowed.

