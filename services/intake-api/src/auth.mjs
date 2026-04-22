const DEFAULT_TENANT_ID = 'tenant.local';
const DEFAULT_LOCAL_ACTOR_ID = 'local-operator';
const DEFAULT_LOCAL_ACTOR_TIMESTAMP = '2026-04-22T00:00:00.000Z';

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {string | undefined | null} tenantId
 * @returns {string}
 */
export function normalizeTenantId(tenantId) {
  return tenantId ?? DEFAULT_TENANT_ID;
}

/**
 * @returns {string}
 */
export function getDefaultTenantId() {
  return DEFAULT_TENANT_ID;
}

/**
 * @returns {any}
 */
export function getDefaultLocalActor() {
  return {
    schemaVersion: '1.0.0',
    id: DEFAULT_LOCAL_ACTOR_ID,
    tenantId: DEFAULT_TENANT_ID,
    email: 'local-operator@localhost.localdomain',
    displayName: 'Local Operator',
    roles: ['Local Operator'],
    status: 'active',
    authProvider: 'local-password',
    createdAt: DEFAULT_LOCAL_ACTOR_TIMESTAMP,
    updatedAt: DEFAULT_LOCAL_ACTOR_TIMESTAMP,
  };
}

/**
 * @returns {any}
 */
export function getActorFromRequest() {
  return clone(getDefaultLocalActor());
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canCreateProject(actor) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canStartWorkflow(actor) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canApplyManualWorkflowEvent(actor) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canResolveCanonicalization(actor) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canExportRun(actor) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @param {string} _approvalRole
 * @returns {boolean}
 */
export function canSubmitApproval(actor, _approvalRole) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canViewTenantData(actor) {
  return Boolean(actor);
}

/**
 * @param {any | null} actor
 * @param {string | undefined} tenantId
 * @returns {boolean}
 */
export function canAccessTenant(actor, tenantId) {
  if (!actor || !canViewTenantData(actor)) {
    return false;
  }

  return normalizeTenantId(actor.tenantId) === normalizeTenantId(tenantId);
}
