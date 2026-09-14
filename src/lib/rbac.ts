export type UserRole =
  | 'TRANSITION_OWNER'
  | 'CONTRIBUTOR'
  | 'REVIEWER'
  | 'EXECUTIVE_APPROVER'
  | 'TEMPLATE_OWNER'
  | 'ADMINISTRATOR'
  | 'READ_ONLY_STAKEHOLDER';

export function parseRoles(rolesJson: string): UserRole[] {
  try {
    const parsed = JSON.parse(rolesJson);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function hasRole(userRoles: UserRole[], ...allowed: UserRole[]): boolean {
  return userRoles.some((r) => allowed.includes(r));
}

export function isAdministrator(userRoles: UserRole[]): boolean {
  return userRoles.includes('ADMINISTRATOR');
}

/**
 * Server-side authorization checks, enforced in API routes — never only in
 * the UI. Each function throws on denial so callers fail closed.
 */
export class ForbiddenError extends Error {
  constructor(message = 'You do not have permission to perform this action.') {
    super(message);
    this.name = 'ForbiddenError';
  }
}

export function requireRole(userRoles: UserRole[], ...allowed: UserRole[]): void {
  if (!isAdministrator(userRoles) && !hasRole(userRoles, ...allowed)) {
    throw new ForbiddenError(`Requires one of: ${allowed.join(', ')}.`);
  }
}

export const CAN_EDIT_INTAKE: UserRole[] = ['TRANSITION_OWNER', 'CONTRIBUTOR', 'ADMINISTRATOR'];
export const CAN_GENERATE_PLAN: UserRole[] = ['TRANSITION_OWNER', 'CONTRIBUTOR', 'ADMINISTRATOR'];
export const CAN_SUBMIT_FOR_REVIEW: UserRole[] = ['TRANSITION_OWNER', 'ADMINISTRATOR'];
export const CAN_APPROVE: UserRole[] = ['EXECUTIVE_APPROVER', 'ADMINISTRATOR'];
export const CAN_MANAGE_TEMPLATES: UserRole[] = ['TEMPLATE_OWNER', 'ADMINISTRATOR'];
export const CAN_GENERATE_ARTIFACTS: UserRole[] = ['TRANSITION_OWNER', 'CONTRIBUTOR', 'ADMINISTRATOR'];
export const CAN_ADMINISTER: UserRole[] = ['ADMINISTRATOR'];
