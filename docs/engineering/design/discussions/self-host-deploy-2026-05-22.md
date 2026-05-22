# Discussion Record: Self-host top-level PRD framing review

| Field | Value |
|---|---|
| Date | 2026-05-22 |
| Subject | self-host-deploy.md pass 2 operator-lifecycle framing rewrite |
| Participants | W_YI + Codex |
| Trigger | After `setup-time.md` and `runtime.md` cleanup, owner and writer revised the top-level `self-host-deploy.md`; Codex reviewed whether the parent PRD correctly absorbed both sub-PRD boundaries |
| Status | no blocking findings; ready for owner/writer review |
| Output target | `docs/product/prd/features/self-host-deploy/self-host-deploy.md` |

## Context

`setup-time.md` and `runtime.md` have both moved into the operator-lifecycle narrative form. The top-level `self-host-deploy.md` was then rewritten to stop acting like a long checklist and instead lock the shared product model for the feature folder.

The current top-level PRD now focuses on:

- 3-tier operator profile: Solo NAS / Team VPS / Public Cloud.
- 5 deploy modes: Canonical OCI / single-binary / NAS template / VPS template / Workers tier 3.
- Lifecycle split: setup-time vs runtime.
- Bootstrap security mode: internet-exposed vs dev-local.
- Cross-feature seams with authentication, identity, notepage, theme-system, plugin-system, AI integration, and discussion.

Codex reviewed the rewritten parent PRD against the already-reviewed `setup-time.md` and `runtime.md` boundaries.

## Section A - Overall Judgment

Current judgment: **`self-host-deploy.md` pass 2 is structurally ready as the parent PRD for this feature folder**.

No blocking issue was found. The rewrite is a good parent-layer shape because it:

- defines the shared model instead of duplicating sub-PRD implementation details;
- keeps setup-time and runtime details delegated to their sub-PRDs;
- makes bootstrap mode a first-class orthogonal dimension;
- keeps M2/M3/M4 gates explicit enough for mechanical review;
- avoids reintroducing earlier over-scopes such as M2 restore, OAuth provider add, or L3 replacement tooling;
- links the top-level restore staging to the runtime PRD instead of inventing a second version.

## Section B - What Is Working

### Parent PRD Scope Is Cleaner

The parent now locks common product concepts and routes detailed behavior to sub-PRDs:

- Operator-active first install / config change / upgrade / L3 replacement goes to `setup-time.md`.
- SHCKB-autonomous backup / health / logs / audit / alerting goes to `runtime.md`.

This is the right responsibility split for a top-level feature-folder PRD.

### Four Orthogonal Dimensions Are Clear

The document now separates:

- operator profile = who runs it and at what scale;
- deploy mode = how the artifact is launched;
- bootstrap mode = first-admin security posture;
- lifecycle phase = setup-time vs runtime.

This prevents common drift:

- treating bootstrap mode as a fourth operator profile;
- treating Workers as equivalent to OCI runtime;
- treating operator profile as a custom behavior fork.

### M2 Scope Stays Tight

The M2 gate is now appropriately parent-level:

- Canonical OCI + Docker compose works on verified paths.
- Single-binary works from the same source and matches M2 user-observable behavior.
- Internet-exposed bootstrap uses profile-seeded admin login.
- Dev-local setup screen is separately verified.
- Setup-time M2 and runtime M2 are referenced rather than restated in full.

This avoids pulling sub-PRD details into a second source of truth.

### Restore Staging Is Aligned

The parent PRD now matches `runtime.md`:

- **M2**: no verified restore endpoint / UI / acceptance gate.
- **M3**: backup-now shortcut + archive validation / dry-run.
- **M4**: canonical local restore smoke.
- **Phase 2+**: cross-deploy restore.

This closes the earlier risk that the parent PRD would imply cross-deploy restore verification in M2.

### Cross-Feature Seams Are Useful

The Cross-Feature Seams table is valuable because it states what self-host-deploy needs from adjacent feature folders without owning their internals:

- auth/identity: first-admin and audit vocabulary;
- notepage: URL / SSR / SEO consistency across deploy modes;
- theme-system: SSR CSS / asset path consistency;
- plugin-system: closed registry Day-1, future marketplace deployment;
- AI/discussion: Phase 2+ deploy/secrets/data-shape boundaries.

## Section C - Cross-Document Alignment

### Setup-Time Alignment

The parent PRD agrees with `setup-time.md` on:

- first install and config mutation requiring setup-time redeploy;
- internet-exposed vs dev-local bootstrap behavior;
- L3 replacement being M2 future marker only;
- M3 pre-upgrade backup integration being backup-now shortcut / archive validation / dry-run;
- M4 owning stronger restore smoke and production polish.

### Runtime Alignment

The parent PRD agrees with `runtime.md` on:

- M2 runtime gates: backup artifact contract, manual backup trigger, `/health`, structured stdout logs, audit baseline;
- no M2 restore gate;
- M3 metrics / audit view / alert baseline / backup integration;
- M4 canonical local restore smoke and deploy-mode constraints;
- Phase 2+ cross-deploy restore.

### Project PRD Alignment

The parent PRD stays aligned with `project.md`:

- self-host onboarding remains a success criterion;
- M2 remains minimum shippable and self-hostable;
- M4 remains broader production polish / second-operator / deploy-mode verification territory;
- K8s, enterprise orchestration, multi-region active-active, and SaaS-hosted service stay outside current scope.

## Section D - Non-Blocking Follow-Ups

No blocking PRD issue was found. The following are optional polish items:

1. **Commit discussion record alongside the rewritten parent PRD**

   This record should travel with the `self-host-deploy.md` rewrite so future readers can see why the parent PRD became a shared-model document rather than a duplicate checklist.

2. **Keep parent PRD from becoming a second acceptance source**

   Future edits should preserve the current rule: parent PRD states top-level gates and links sub-PRDs; setup-time and runtime own detailed acceptance.

3. **Consider a later discussion status update only if owner changes restore milestone**

   Current restore staging is coherent. If owner later moves restore verification earlier or later, update `runtime.md`, `setup-time.md`, `self-host-deploy.md`, and this discussion together.

## Section E - References

- PRD under review: [self-host-deploy.md](../../../product/prd/features/self-host-deploy/self-host-deploy.md)
- Sub-PRDs: [setup-time.md](../../../product/prd/features/self-host-deploy/setup-time.md) / [runtime.md](../../../product/prd/features/self-host-deploy/runtime.md)
- Parent project PRD: [project.md](../../../product/prd/project.md)
- Related auth PRDs: [authentication.md](../../../product/prd/features/authentication/authentication.md) / [identity.md](../../../product/prd/features/authentication/identity.md)
- Related feature PRDs: [notepage.md](../../../product/prd/features/notepage/notepage.md) / [theme-system.md](../../../product/prd/features/theme-system/theme-system.md) / [plugin-system.md](../../../product/prd/features/plugin-system/plugin-system.md)
- Related discussion records:
  - [self-host-setup-time-2026-05-21.md](./self-host-setup-time-2026-05-21.md)
  - [self-host-runtime-2026-05-22.md](./self-host-runtime-2026-05-22.md)
- Audit register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-22 initial record: captured top-level `self-host-deploy.md` pass 2 review after setup-time and runtime cleanup; no blocking findings; documented shared-model parent PRD shape, cross-document alignment, restore staging alignment, and non-blocking follow-ups.
