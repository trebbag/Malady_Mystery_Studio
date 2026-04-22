import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';

import { createId } from '../../../packages/shared-config/src/ids.mjs';

const DEFAULT_TENANT_ID = 'tenant.demo';
const DEFAULT_TENANT_SLUG = 'studio-demo';
const SESSION_COOKIE_NAME = 'dcp_session';
const OWNER_ROLES = ['Org Owner', 'Org Admin'];
const DEFAULT_DEMO_PASSWORD = 'demo-password';

/** @type {Record<string, string[]>} */
const APPROVAL_ROLE_TO_USER_ROLES = {
  clinical: ['Clinical Reviewer'],
  editorial: ['Story Editor'],
  product: ['Product Editor'],
  security: ['Compliance Auditor'],
};

const DEMO_SEED_USERS = [
  {
    id: 'usr.owner.001',
    tenantId: DEFAULT_TENANT_ID,
    email: 'owner@studio-demo.local',
    displayName: 'Studio Owner',
    roles: ['Org Owner', 'Org Admin', 'Clinical Reviewer', 'Story Editor', 'Product Editor', 'Compliance Auditor', 'Viewer'],
    authProvider: 'local-password',
  },
  {
    id: 'usr.clinical.001',
    tenantId: DEFAULT_TENANT_ID,
    email: 'clinical@studio-demo.local',
    displayName: 'Clinical Reviewer',
    roles: ['Clinical Reviewer', 'Viewer'],
    authProvider: 'local-password',
  },
  {
    id: 'usr.story.001',
    tenantId: DEFAULT_TENANT_ID,
    email: 'story@studio-demo.local',
    displayName: 'Story Editor',
    roles: ['Story Editor', 'Viewer'],
    authProvider: 'local-password',
  },
  {
    id: 'usr.product.001',
    tenantId: DEFAULT_TENANT_ID,
    email: 'product@studio-demo.local',
    displayName: 'Product Editor',
    roles: ['Product Editor', 'Viewer'],
    authProvider: 'local-password',
  },
  {
    id: 'usr.auditor.001',
    tenantId: DEFAULT_TENANT_ID,
    email: 'auditor@studio-demo.local',
    displayName: 'Compliance Auditor',
    roles: ['Compliance Auditor', 'Viewer'],
    authProvider: 'local-password',
  },
  {
    id: 'usr.viewer.001',
    tenantId: DEFAULT_TENANT_ID,
    email: 'viewer@studio-demo.local',
    displayName: 'Read-only Reviewer',
    roles: ['Viewer'],
    authProvider: 'local-password',
  },
  {
    id: 'usr.outside.001',
    tenantId: 'tenant.outside',
    email: 'outsider@outside.local',
    displayName: 'Outside Tenant Reviewer',
    roles: ['Clinical Reviewer', 'Viewer'],
    authProvider: 'local-password',
  },
];

/**
 * @template T
 * @param {T} value
 * @returns {T}
 */
function clone(value) {
  return structuredClone(value);
}

/**
 * @param {string | undefined} cookieHeader
 * @returns {Record<string, string>}
 */
export function parseCookies(cookieHeader) {
  if (!cookieHeader) {
    return {};
  }

  return Object.fromEntries(
    cookieHeader
      .split(';')
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const separatorIndex = part.indexOf('=');

        if (separatorIndex === -1) {
          return [part, ''];
        }

        return [part.slice(0, separatorIndex), decodeURIComponent(part.slice(separatorIndex + 1))];
      }),
  );
}

/**
 * @param {string} value
 * @returns {string}
 */
function base64UrlDecode(value) {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  return Buffer.from(padded, 'base64').toString('utf8');
}

/**
 * @param {string} value
 * @returns {string}
 */
function base64UrlEncode(value) {
  return Buffer.from(value, 'utf8').toString('base64url');
}

/**
 * @param {string} password
 * @param {string} salt
 * @returns {string}
 */
function derivePasswordHash(password, salt) {
  return scryptSync(password, salt, 64).toString('hex');
}

/**
 * @param {string} password
 * @returns {string}
 */
function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `${salt}:${derivePasswordHash(password, salt)}`;
}

/**
 * @param {string} password
 * @param {string | null} storedHash
 * @returns {boolean}
 */
function verifyPassword(password, storedHash) {
  if (!storedHash) {
    return false;
  }

  const [salt, passwordHash] = storedHash.split(':');

  if (!salt || !passwordHash) {
    return false;
  }

  const candidateHash = derivePasswordHash(password, salt);
  return timingSafeEqual(Buffer.from(passwordHash, 'hex'), Buffer.from(candidateHash, 'hex'));
}

/**
 * @param {string} token
 * @returns {string}
 */
export function hashSessionToken(token) {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * @param {string} rawToken
 * @param {{ issuer: string, audience: string, sharedSecret: string }} config
 * @returns {any}
 */
function verifyHs256Jwt(rawToken, config) {
  const segments = rawToken.split('.');

  if (segments.length !== 3) {
    throw new Error('OIDC token must contain three JWT segments.');
  }

  const [encodedHeader, encodedPayload, encodedSignature] = segments;
  const header = JSON.parse(base64UrlDecode(encodedHeader));
  const payload = JSON.parse(base64UrlDecode(encodedPayload));

  if (header.alg !== 'HS256') {
    throw new Error('Only HS256 OIDC starter assertions are supported in this slice.');
  }

  const signedPart = `${encodedHeader}.${encodedPayload}`;
  const expectedSignature = createHmac('sha256', config.sharedSecret).update(signedPart).digest('base64url');

  if (!timingSafeEqual(Buffer.from(encodedSignature), Buffer.from(expectedSignature))) {
    throw new Error('OIDC token signature is invalid.');
  }

  if (payload.iss !== config.issuer) {
    throw new Error('OIDC token issuer does not match configuration.');
  }

  const audience = Array.isArray(payload.aud) ? payload.aud : [payload.aud];

  if (!audience.includes(config.audience)) {
    throw new Error('OIDC token audience does not match configuration.');
  }

  if (typeof payload.exp === 'number' && payload.exp * 1000 < Date.now()) {
    throw new Error('OIDC token has expired.');
  }

  return payload;
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
 * @returns {string}
 */
export function getDefaultTenantSlug() {
  return DEFAULT_TENANT_SLUG;
}

/**
 * @param {{ demoPassword?: string }} [options]
 * @returns {string}
 */
export function getDemoPassword(options = {}) {
  return options.demoPassword ?? process.env.DEMO_LOCAL_PASSWORD ?? DEFAULT_DEMO_PASSWORD;
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {{ demoPassword?: string }} [options]
 * @returns {void}
 */
export function seedIdentityData(store, options = {}) {
  const now = new Date().toISOString();
  const demoPasswordHash = hashPassword(getDemoPassword(options));

  for (const tenant of [
    {
      schemaVersion: '1.0.0',
      id: DEFAULT_TENANT_ID,
      slug: DEFAULT_TENANT_SLUG,
      displayName: 'Studio Demo Tenant',
      status: 'active',
      ssoMode: 'oidc-hs256',
      retentionDefaults: {
        artifactRetentionDays: 365,
        auditRetentionDays: 2555,
        sessionTtlHours: 12,
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      schemaVersion: '1.0.0',
      id: 'tenant.outside',
      slug: 'outside-tenant',
      displayName: 'Outside Tenant',
      status: 'active',
      ssoMode: 'local-password',
      retentionDefaults: {
        artifactRetentionDays: 180,
        auditRetentionDays: 2555,
        sessionTtlHours: 8,
      },
      createdAt: now,
      updatedAt: now,
    },
  ]) {
    store.saveTenant(tenant);
  }

  for (const user of DEMO_SEED_USERS) {
    store.saveUserAccount(
      {
        schemaVersion: '1.0.0',
        ...user,
        status: 'active',
        createdAt: now,
        updatedAt: now,
      },
      {
        passwordHash: demoPasswordHash,
        subject: user.email,
      },
    );
  }
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {{ tenantSlug?: string, email: string, password: string }} credentials
 * @returns {{ actor: any, session: any, sessionToken: string }}
 */
export function authenticateLocalPassword(store, credentials) {
  const tenant = credentials.tenantSlug
    ? store.getTenantBySlug(credentials.tenantSlug)
    : store.getTenant(DEFAULT_TENANT_ID);

  if (!tenant) {
    throw new Error('Tenant is not configured for local login.');
  }

  const authUser = store.getAuthUserByEmail(tenant.id, credentials.email);

  if (!authUser || !verifyPassword(credentials.password, authUser.passwordHash)) {
    throw new Error('Email or password is invalid.');
  }

  return createSessionForActor(store, authUser.user, 'local-password');
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {{ idToken: string, issuer: string, audience: string, sharedSecret: string }} options
 * @returns {{ actor: any, session: any, sessionToken: string }}
 */
export function exchangeOidcAssertion(store, options) {
  const claims = verifyHs256Jwt(options.idToken, {
    issuer: options.issuer,
    audience: options.audience,
    sharedSecret: options.sharedSecret,
  });
  const tenant = store.getTenant(normalizeTenantId(claims.tenant_id));

  if (!tenant) {
    throw new Error('OIDC token referenced an unknown tenant.');
  }

  const email = typeof claims.email === 'string' ? claims.email : `${claims.sub}@oidc.local`;
  const displayName = typeof claims.name === 'string' ? claims.name : email;
  const roles = Array.isArray(claims.roles) && claims.roles.length > 0 ? claims.roles : ['Viewer'];
  const existingUser = store.getAuthUserByProviderSubject(tenant.id, 'oidc-hs256', claims.sub)
    ?? store.getAuthUserByEmail(tenant.id, email);
  const now = new Date().toISOString();
  const user = {
    schemaVersion: '1.0.0',
    id: existingUser?.user.id ?? createId('usr'),
    tenantId: tenant.id,
    email,
    displayName,
    roles,
    status: 'active',
    authProvider: 'oidc-hs256',
    createdAt: existingUser?.user.createdAt ?? now,
    updatedAt: now,
  };

  store.saveUserAccount(user, {
    passwordHash: existingUser?.passwordHash ?? null,
    subject: claims.sub,
  });

  return createSessionForActor(store, user, 'oidc-hs256');
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {any} actor
 * @param {'local-password' | 'oidc-hs256'} authMethod
 * @returns {{ actor: any, session: any, sessionToken: string }}
 */
export function createSessionForActor(store, actor, authMethod) {
  const tenant = store.getTenant(actor.tenantId) ?? {
    retentionDefaults: {
      sessionTtlHours: 12,
    },
  };
  const createdAt = new Date().toISOString();
  const expiresAt = new Date(Date.now() + (tenant.retentionDefaults?.sessionTtlHours ?? 12) * 60 * 60 * 1000).toISOString();
  const session = {
    schemaVersion: '1.0.0',
    id: createId('ses'),
    tenantId: actor.tenantId,
    userId: actor.id,
    authMethod,
    expiresAt,
    createdAt,
    lastSeenAt: createdAt,
  };
  const sessionToken = randomBytes(32).toString('base64url');
  store.createSession(session, hashSessionToken(sessionToken), {
    email: actor.email,
  });
  return {
    actor: clone(actor),
    session,
    sessionToken,
  };
}

/**
 * @param {string} sessionToken
 * @param {string} expiresAt
 * @returns {string}
 */
export function createSessionCookie(sessionToken, expiresAt) {
  const maxAge = Math.max(0, Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000));
  return `${SESSION_COOKIE_NAME}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
}

/**
 * @returns {string}
 */
export function clearSessionCookie() {
  return `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
}

/**
 * @param {import('node:http').IncomingMessage} request
 * @param {import('./store.mjs').PlatformStore} store
 * @param {{ allowHeaderAuthBypass?: boolean }} [options]
 * @returns {any | null}
 */
export function getActorFromRequest(request, store, options = {}) {
  if (options.allowHeaderAuthBypass) {
    const headerUserId = request.headers['x-dcp-user-id'];
    const normalizedHeaderUserId = Array.isArray(headerUserId) ? headerUserId[0] : headerUserId;

    if (typeof normalizedHeaderUserId === 'string') {
      for (const tenant of store.listTenants()) {
        const actor = store.getUserAccount(normalizedHeaderUserId, tenant.id);

        if (actor) {
          return actor;
        }
      }
    }
  }

  const cookies = parseCookies(Array.isArray(request.headers.cookie) ? request.headers.cookie[0] : request.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (!sessionToken) {
    return null;
  }

  const sessionLookup = store.getSessionByTokenHash(hashSessionToken(sessionToken));

  if (!sessionLookup) {
    return null;
  }

  if (new Date(sessionLookup.session.expiresAt).getTime() <= Date.now()) {
    store.deleteSessionByTokenHash(hashSessionToken(sessionToken));
    return null;
  }

  store.touchSession(sessionLookup.session.id, new Date().toISOString());
  return sessionLookup.actor;
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {import('node:http').IncomingMessage} request
 * @returns {void}
 */
export function revokeSessionFromRequest(store, request) {
  const cookies = parseCookies(Array.isArray(request.headers.cookie) ? request.headers.cookie[0] : request.headers.cookie);
  const sessionToken = cookies[SESSION_COOKIE_NAME];

  if (sessionToken) {
    store.deleteSessionByTokenHash(hashSessionToken(sessionToken));
  }
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @returns {any[]}
 */
export function listDemoAccounts(store) {
  const tenant = store.getTenant(DEFAULT_TENANT_ID);
  return tenant ? store.listTenantUsers(tenant.id) : [];
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {string} tenantId
 * @returns {any[]}
 */
export function listTenantUsers(store, tenantId) {
  return store.listTenantUsers(tenantId);
}

/**
 * @param {import('./store.mjs').PlatformStore} store
 * @param {{ tenantId: string, userId: string, roles: string[] }} options
 * @returns {any}
 */
export function updateTenantUserRoles(store, options) {
  const actor = store.getUserAccount(options.userId, options.tenantId);

  if (!actor) {
    throw new Error('User membership was not found for this tenant.');
  }

  const updatedActor = {
    ...actor,
    roles: [...options.roles],
    updatedAt: new Date().toISOString(),
  };
  store.saveUserAccount(updatedActor);
  return updatedActor;
}

/**
 * @param {any | null} actor
 * @param {string[]} allowedRoles
 * @returns {boolean}
 */
export function actorHasAnyRole(actor, allowedRoles) {
  if (!actor) {
    return false;
  }

  return actor.roles.some((/** @type {string} */ role) => allowedRoles.includes(role));
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canCreateProject(actor) {
  return actorHasAnyRole(actor, [...OWNER_ROLES, 'Clinical Reviewer', 'Story Editor', 'Product Editor']);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canStartWorkflow(actor) {
  return canCreateProject(actor);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canApplyManualWorkflowEvent(actor) {
  return actorHasAnyRole(actor, OWNER_ROLES);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canResolveCanonicalization(actor) {
  return actorHasAnyRole(actor, [...OWNER_ROLES, 'Clinical Reviewer']);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canExportRun(actor) {
  return actorHasAnyRole(actor, [...OWNER_ROLES, 'Product Editor']);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canManageTenantUsers(actor) {
  return actorHasAnyRole(actor, OWNER_ROLES);
}

/**
 * @param {any | null} actor
 * @param {string} approvalRole
 * @returns {boolean}
 */
export function canSubmitApproval(actor, approvalRole) {
  const allowedRoles = APPROVAL_ROLE_TO_USER_ROLES[approvalRole];

  if (!allowedRoles) {
    return false;
  }

  return actorHasAnyRole(actor, [...OWNER_ROLES, ...allowedRoles]);
}

/**
 * @param {any | null} actor
 * @returns {boolean}
 */
export function canViewTenantData(actor) {
  return actorHasAnyRole(actor, [
    ...OWNER_ROLES,
    'Clinical Reviewer',
    'Story Editor',
    'Art/Prompt Reviewer',
    'Product Editor',
    'Compliance Auditor',
    'Viewer',
  ]);
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

  return actor.tenantId === normalizeTenantId(tenantId);
}

/**
 * @param {{ sub: string, email: string, name: string, tenant_id: string, roles: string[], iss?: string, aud?: string, exp?: number }} claims
 * @param {string} sharedSecret
 * @param {{ issuer: string, audience: string }} options
 * @returns {string}
 */
export function createStarterOidcAssertion(claims, sharedSecret, options) {
  const header = base64UrlEncode(JSON.stringify({
    alg: 'HS256',
    typ: 'JWT',
  }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: options.issuer,
    aud: options.audience,
    exp: claims.exp ?? Math.floor(Date.now() / 1000) + 3600,
    ...claims,
  }));
  const signature = createHmac('sha256', sharedSecret).update(`${header}.${payload}`).digest('base64url');
  return `${header}.${payload}.${signature}`;
}
