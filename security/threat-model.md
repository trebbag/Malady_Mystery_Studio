# Threat model (initial)

## Threat families

### 1. Medical misinformation
Risk: the system generates clinically misleading disease explanations, visuals, or treatment claims.

Mitigations:
- evidence traceability
- medical evals
- human clinical review
- release gates

### 2. Prompt or workflow drift
Risk: hidden prompt changes or orchestration changes degrade quality without obvious code failures.

Mitigations:
- prompt registry
- eval gates
- review templates
- change documentation

### 3. Unauthorized release
Risk: artifacts are exported without required approvals.

Mitigations:
- approval objects
- release gates
- audit logs
- role checks

### 4. Sensitive data leakage
Risk: if patient-like or customer data is introduced later, it could leak through logs, prompts, exports, or third-party services.

Mitigations:
- data classification
- least privilege
- redaction strategy
- provider and logging controls

### 5. Supply-chain and dependency risk
Risk: insecure dependencies or CI workflows compromise the platform.

Mitigations:
- dependency review
- CI hardening
- secret scanning
- environment separation
