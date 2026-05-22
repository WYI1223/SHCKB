# Discussion Record: Self-host runtime PRD narrative form review

| Field | Value |
|---|---|
| Date | 2026-05-22 |
| Subject | self-host-deploy/runtime.md pass 2 operator-lifecycle narrative rewrite |
| Participants | W_YI + Codex |
| Trigger | Owner asked Codex to review `runtime.md` with the same multi-angle criteria used for `setup-time.md` |
| Status | cleanup applied; ready for owner review |
| Output target | `docs/product/prd/features/self-host-deploy/runtime.md`; possible follow-up sync to `setup-time.md`, `identity.md`, `self-host-deploy.md`, and `AUDIT-2026-05.md` |

## Context

`runtime.md` pass 2 rewrites the runtime PRD into the same narrative-first operator-lifecycle form already used for `setup-time.md`:

- What this PRD covers
- Why
- The whole picture
- User-facing experience
- MVP / Progressive completeness / Done
- Reference appendix

Codex assessment: the form is directionally correct for runtime. Runtime is also an operator-lifecycle PRD because the reader must first understand the operating state, the boundary between SHCKB-autonomous behavior and operator-active redeploy, and which runtime entries are allowed without config mutation.

The main concern is not the form. The main concern is that pass 2 softened several hard execution boundaries from the older PRD, especially around restore scope, backup archive semantics, audit baseline alignment, and log access.

## Section A - Overall Judgment

Current judgment: `runtime.md` pass 2 is structurally good, but should not be treated as ready for the next section until several M2 boundaries are sharpened.

What works:

- The setup-time vs runtime split is clear.
- `Runtime entry != config change` is the right mental model.
- M2/M3/M4 sections are visible and mostly mechanically reviewable.
- M2 correctly avoids webhook/email alerts and full metrics.
- S3-compatible backup is kept as optional smoke, not a release gate.
- Workers constraints are deferred to M4, which matches the broader deploy-mode strategy.

What still needs cleanup:

- Restore appears as a runtime entry, but M2 restore scope is later left open.
- Backup success is not defined strongly enough for an upgrade-recovery dependency.
- Audit baseline drifts from `identity.md`.
- Log access wording can be misread as requiring a web log viewer or export flow in M2.
- Health check has behavior, but not enough minimum contract for mechanical implementation.

## Section B - Highest-Priority Findings

### 1. Restore M2 scope is internally ambiguous

`runtime.md` says operator can trigger `restore`, and the lifecycle diagram includes `backup now / restore / view health / view logs` as runtime entries.

However, the M2 capability matrix does not include a restore gate, and the Open Questions section says the preferred direction is that M2 does not do a fully verified restore path.

This creates an execution risk: an implementation agent may implement a restore endpoint or admin UI because restore appears in the main narrative, even though the intended M2 gate appears to be backup-only.

Recommended resolution:

- State explicitly near R2 and in the M2 matrix:
  - **M2 = backup-only verified path**.
  - Restore belongs to the runtime domain, but M2 only keeps a runbook marker / future contract.
  - No verified restore endpoint, no restore UI, and no restore acceptance gate in M2 unless the owner later promotes it.
  - Restore verification / dry-run / stronger recovery flow starts in M3+.

Suggested PRD wording:

```text
M2 verifies backup creation and backup status only. Restore is a runtime-domain concept, but M2 does not ship a verified restore UX/API gate; it only documents the future restore/runbook boundary. Restore dry-run and verified restore are M3+.
```

### 2. Backup "success" semantics are too soft

M2 currently requires daily local backup, retention/GC, visible status, and manual backup trigger returning archive ID / status.

That is not enough if setup-time upgrade recovery depends on backup + runbook. A backup task that emits an archive ID is not necessarily a usable recovery artifact.

Recommended resolution: define a minimum M2 backup artifact contract without overbuilding full restore verification.

M2 should require:

- archive includes app/schema version metadata;
- archive includes DB snapshot / dump;
- archive records blob/storage inclusion policy;
- archive has a manifest;
- archive has checksum or equivalent integrity marker;
- success status is written only after the archive is complete;
- partial backup is never eligible for retention as a valid backup.

This keeps M2 implementable while giving later ADR-0017 / runbook work a real contract to build on.

Suggested PRD wording:

```text
M2 backup success means a complete local archive exists with manifest, app/schema version metadata, DB snapshot, storage/blob policy, and checksum or equivalent complete marker. Backup status may be `success` only after the archive is complete; partial archives are invalid and excluded from retention.
```

### 3. Audit baseline drifts from identity PRD

`identity.md` requires M2 auth audit events including admin login/logout, user create/disable/role change, password reset, first admin setup, and failed login.

`runtime.md` currently lists several audit events but omits `failed login`. It also lists `backup restored`, which becomes ambiguous if restore is not actually in M2.

Recommended resolution:

- Treat `identity.md` as source of truth for auth-domain audit event names.
- `runtime.md` should own the runtime visibility/transport guarantee: those events are emitted as structured audit events/logs.
- Add `failed login` to the runtime baseline list.
- Qualify `backup restored` as future / when restore path exists if restore is not M2.

Suggested PRD wording:

```text
Auth-domain audit event names follow `identity.md`; runtime owns that these events are emitted and observable through structured logs in M2.
```

### 4. Log access can be misread as M2 web log viewer/export

The narrative says operator can view logs and "export log" as runtime entries, while M2 gates only require structured stdout.

That wording can make an execution agent implement an admin web log viewer or export endpoint prematurely.

Recommended resolution:

- State that M2 log access means stdout / Docker logs / single-binary stdout.
- Webapp log viewer, audit trail view, log export, and real-time log streaming are not M2 unless separately promoted.
- Keep admin-only audit trail webapp view in M3.

Suggested PRD wording:

```text
M2 log access = structured stdout readable through Docker/Podman logs or single-binary stdout. M2 does not require a web log viewer, log export endpoint, or live tail UI.
```

### 5. Health check needs a minimum contract

The current PRD requires `ok` / `degraded` / `down`, anonymous access, low cost, and no secrets. That is directionally good, but still leaves implementation too loose.

Recommended resolution: define a small response contract and probe budget without over-specifying the API.

Minimum M2 contract should include:

- top-level status;
- per-subsystem status for DB / storage / search / backup / auth;
- timestamp or checked-at value;
- no secrets / no PII;
- bounded probe timeout;
- no heavy query or large scan.

Suggested PRD wording:

```text
M2 `/health` returns a small JSON object with top-level status, checked_at, and per-subsystem reachability for DB/storage/search/backup/auth. Probes must be bounded and cheap; the response must not include secrets, PII, connection strings, or raw provider errors.
```

## Section C - Multi-Angle Review

### Document / PRD angle

The narrative-first form works for runtime because the topic is an operating-mode boundary, not a narrow feature flow.

The PRD already does well at:

- putting mental model before detailed gates;
- separating M2 / M3 / M4;
- keeping non-goals in the Reference appendix;
- avoiding monitoring-stack lock-in.

The remaining issue is that some open questions are not merely future questions. Restore scope and backup artifact semantics affect M2 acceptance and should be resolved in the main PRD body.

### Writer angle

The rewrite is readable and coherent. The writer successfully avoided the old checklist feel.

The risk is that smooth prose hides product gates. When the text says "operator can trigger restore" in the main narrative, most readers will assume it is available unless the same paragraph says otherwise.

Recommendation: every future-domain runtime verb that appears in the main narrative should carry a visible M-stage marker.

### Reader angle

The operator mental model is strong:

- running instance;
- SHCKB-autonomous behavior;
- runtime entries;
- setup-time redeploy for config mutation.

But a reader still cannot answer these M2 questions without scanning multiple sections:

- Can I restore in M2?
- What exactly is a valid backup?
- Do I get a log viewer or only stdout logs?
- Is failed login part of audit baseline?

Those should be answered where the capability is introduced, not only in Open Questions.

### Executor angle

This version gives good constraints:

- no runtime config hot reload;
- no M2 webhook/email alert;
- no S3 backup as release gate;
- no metrics endpoint until M3;
- no Workers parity until M4.

But executor constraints are still weak around:

- restore endpoint/UI;
- backup archive format and validity;
- log viewer/export;
- audit event source of truth.

Recommended explicit M2 constraints:

- Do not implement restore endpoint/UI as an M2 gate.
- Do not implement log viewer/export/live-tail as an M2 gate.
- Do implement structured stdout logs.
- Do implement backup artifact complete marker / manifest / metadata.
- Do align auth audit event names with `identity.md`.

### Community / open-source contributor angle

The document is contributor-friendly because it does not force a specific monitoring stack. Prometheus, Grafana, Loki, ELK, SMTP, S3, and alert managers remain operator choices.

To make this clearer for external contributors, the PRD should state:

```text
SHCKB exposes runtime signals; operators choose their monitoring/logging/alerting stack.
```

This prevents contributors from treating Grafana/Loki/Prometheus integration as product-required M2 work.

### Extensibility / maintainability angle

The M3/M4 layering is reasonable:

- M2: backup + health + stdout logs + audit baseline.
- M3: metrics, audit webapp view, alert delivery, pre-upgrade backup integration.
- M4: deploy-mode breadth and constrained runtime behavior.

The largest maintainability risk is backup artifact drift. Runtime backup, setup-time upgrade recovery, ADR-0017, DR runbook, and cross-deploy restore all depend on the same artifact semantics. If M2 leaves "backup" vague, later docs will diverge.

Recommended source-of-truth split:

- `runtime.md`: backup artifact is created, valid, observable, and retained.
- `setup-time.md`: upgrade flow warns and points to the manual backup path.
- ADR-0017: exact backup provider implementation and integrity mechanism.
- future runbook: human recovery and restore procedure.

### Agent constraint angle

The PRD gives enough high-level flexibility for implementation libraries and monitoring stacks. It should add sharper "do not build in M2" constraints for restore and log viewer/export.

Good existing constraints:

- no hot reload;
- config changes require redeploy;
- alerts are M3;
- metrics are M3;
- S3 backup is optional smoke;
- Workers constraints are M4.

Missing constraints:

- M2 restore is not a gate;
- M2 log access is stdout only;
- M2 backup success needs a minimum artifact contract;
- audit event vocabulary follows identity/auth PRDs, not a second independent list.

## Section D - Recommended Follow-Up Order

1. Resolve restore scope in the main narrative and M2 matrix.
2. Add minimum backup artifact / success semantics.
3. Align audit event baseline with `identity.md`, especially `failed login`.
4. Clarify M2 log access as stdout-only.
5. Add small `/health` response contract and probe-cost rule.
6. If any of these change surfaced ADR debts, update `AUDIT-2026-05.md` after PRD text is ratified.

## Section E - Execution Note（2026-05-22）

Applied after owner approved the cleanup direction:

- `runtime.md` now states **M2 = backup-only verified path**. Restore remains a runtime-domain concept, but M2 does not ship a verified restore endpoint, restore UI, or restore acceptance gate.
- Added M2 backup success semantics: successful backup requires a complete local artifact with manifest, app/schema version metadata, DB snapshot, blob/storage policy, and checksum or equivalent complete marker; partial archives are invalid and excluded from retention.
- Aligned audit baseline wording with `identity.md`: auth event names follow identity; runtime owns observable structured audit emission. Added `failed login`; qualified `backup restored` as future / only when restore path exists.
- Clarified M2 log access as structured stdout via Docker/Podman logs or single-binary stdout. Web log viewer, log export endpoint, and live tail UI are not M2 gates.
- Added M2 `/health` minimum contract: top-level status, `checked_at`, per-subsystem reachability for DB/storage/search/backup/auth, bounded cheap probes, and no secrets/PII/connection strings/raw provider errors.
- Updated runtime M2 matrix, acceptance gates, non-goals, open questions, invariants, and changelog to reflect the cleanup.

## Section F - Follow-up Review After Cleanup（2026-05-22）

Codex reviewed the post-cleanup `runtime.md` against the five findings in this discussion record.

**What is fixed**:

- Restore is no longer an M2 gate. `runtime.md` now states that M2 is a backup-only verified path, with no verified restore endpoint, restore UI, or restore acceptance gate.
- M2 backup success semantics are now explicit: a successful local backup artifact needs manifest, app/schema version metadata, DB snapshot, blob/storage policy, and checksum or equivalent complete marker; partial archives are invalid and excluded from retention.
- Audit baseline now follows `identity.md`, includes `failed login`, and qualifies `backup restored` as future / only when restore path exists.
- M2 log access is now structured stdout only; web log viewer, log export endpoint, and live tail UI are explicitly not M2 gates.
- `/health` now has a minimum response contract and probe-cost rule.

**Remaining issues**:

1. **Restore milestone is still inconsistent across sections**

   `runtime.md` now says restore dry-run / verified restore starts from M3+ in the R2 section, and M3 lists pre-upgrade backup integration with restore verification. But Open Questions still says the exact restore milestone may be M3, M4, or Phase 2+.

   Recommended resolution: choose one:

   - If owner wants restore verification in M3, remove the Open Question uncertainty and state **M3 = backup-now shortcut + dry-run + restore verification**.
   - If owner does not want to commit yet, change M3 wording to **backup-now shortcut / dry-run; restore verification milestone TBD**.

2. **`identity.md` is now a source-of-truth reference but not fully linked**

   `runtime.md` says auth-domain audit event names follow `identity.md`, but the Dependencies / References section only gives a broad cross-folder list.

   Recommended resolution: add `identity.md` explicitly as the auth audit vocabulary source, and make the first `identity.md` mention an inline link.

3. **Parent PRD backup/restore open question should reflect the new M2 boundary**

   `self-host-deploy.md` still asks whether backup / restore can work across deploy modes. That question is valid, but now `runtime.md` clearly says verified restore is not M2.

   Recommended resolution: add a short qualifier in the parent PRD open question: cross-deploy restore verification is **not M2**; milestone follows runtime restore decision.

4. **Discussion status was stale**

   The top-level status previously said `pending writer cleanup`, even though this record now contains an execution note showing cleanup has been applied.

   This update changes status to `cleanup applied; pending restore milestone sync`.

**Current judgment**:

The original five runtime findings are materially closed. The only blocking product ambiguity is the restore milestone. The rest are cross-reference / reader-orientation cleanup items.

## Section G - Execution Note — Restore Milestone Sync（2026-05-22）

Applied after owner approved the follow-up direction:

- `runtime.md`: restore milestone split is now explicit:
  - **M2**: backup-only verified path.
  - **M3**: backup-now shortcut + archive validation / dry-run; no real restore write guarantee.
  - **M4**: canonical local restore smoke.
  - **Phase 2+**: cross-deploy restore and full DR runbook.
- `runtime.md`: first `identity.md` audit-vocabulary mention is now an inline link, and References list `identity.md` as auth-domain audit event vocabulary source.
- `self-host-deploy.md`: backup/restore cross-deploy open question now states cross-deploy restore verification is not M2 and follows the runtime restore milestone split.

**Updated judgment**: runtime PRD pass 2 cleanup is ready for owner/writer review. Remaining restore work is no longer an M2 ambiguity; it is staged as M3/M4/Phase 2+ scope.

## Section H - Follow-up Review After Restore Milestone Sync（2026-05-22）

Codex reviewed the writer's restore milestone sync across `runtime.md`, `self-host-deploy.md`, `setup-time.md`, and this discussion record.

**What is fixed**:

- `runtime.md` now gives a concrete restore staging:
  - **M2**: backup-only verified path.
  - **M3**: archive validation / dry-run; no real restore write guarantee.
  - **M4**: canonical local restore smoke.
  - **Phase 2+**: cross-deploy restore and full DR runbook.
- `self-host-deploy.md` now states that cross-deploy restore verification is not M2 and follows the runtime restore milestone.
- `identity.md` is now explicitly linked in `runtime.md` as the auth-domain audit event vocabulary source.
- This discussion record status is now `cleanup applied; restore milestone synced`.

**New findings**:

1. **`setup-time.md` still has stale M3 restore wording**

   `runtime.md` now says M3 only provides backup artifact validation / dry-run and does not promise real restore writes; M4 owns canonical local restore smoke.

   `setup-time.md` still says M3 pre-upgrade backup integration includes "backup-now shortcut / dry-run / stronger restore verification". That phrase can be read as pulling M4 restore verification back into M3.

   Recommended resolution: rewrite the `setup-time.md` M3 line as:

   ```text
   Pre-upgrade backup integration -> from M2 manual warning to backup-now shortcut / archive validation / dry-run; canonical restore smoke follows runtime M4.
   ```

2. **`runtime.md` Open Questions #4 is now a resolved milestone note**

   `runtime.md` Open Questions #4 now states the restore milestone split clearly: M2 backup-only, M3 archive validation / dry-run, M4 canonical local restore smoke, Phase 2+ cross-deploy restore.

   This is no longer an open question. It should either move to a resolved milestone note or the section title should distinguish open questions from resolved notes.

**Current judgment**:

The restore milestone ambiguity is resolved in `runtime.md` and the parent PRD. The only remaining cross-document cleanup is the stale `setup-time.md` wording. The Open Questions classification is a non-blocking documentation hygiene issue.

## Section I - Execution Note — Final Cleanup（2026-05-22）

Applied after owner approved final cleanup:

- `setup-time.md`: M3 pre-upgrade backup integration wording now says backup-now shortcut / archive validation / dry-run; canonical restore smoke follows `runtime.md` M4.
- `runtime.md`: restore milestone moved out of Open Questions into Resolved Scope Notes.
- Discussion status updated to `cleanup applied; ready for owner review`.

**Updated judgment**: runtime PRD pass 2 is ready for owner review. No known M2 boundary ambiguity remains in this discussion thread.

## Section J - References

- PRD under review: [runtime.md](../../../product/prd/features/self-host-deploy/runtime.md)
- Sibling PRD: [setup-time.md](../../../product/prd/features/self-host-deploy/setup-time.md)
- Parent PRD: [self-host-deploy.md](../../../product/prd/features/self-host-deploy/self-host-deploy.md)
- Related auth PRDs: [authentication.md](../../../product/prd/features/authentication/authentication.md) / [identity.md](../../../product/prd/features/authentication/identity.md) / [pep.md](../../../product/prd/features/authentication/pep.md)
- Related discussion: [self-host-setup-time-2026-05-21.md](./self-host-setup-time-2026-05-21.md)
- Audit register: [AUDIT-2026-05.md](../../decisions/AUDIT-2026-05.md)

## Changelog

- 2026-05-22 initial record: captured runtime PRD pass 2 review, including restore M2 ambiguity, backup success semantics, audit baseline drift, log access scope, health check contract, multi-angle assessment, and recommended follow-up order.
- 2026-05-22 execution note captured: owner-approved cleanup applied to `runtime.md`, resolving restore M2 ambiguity, backup success semantics, audit baseline drift, log access scope, and health check minimum contract.
- 2026-05-22 follow-up review after cleanup captured: original five findings are materially closed; remaining issues narrowed to restore milestone sync, explicit `identity.md` reference, parent PRD backup/restore qualifier, and discussion status update.
- 2026-05-22 restore milestone sync captured: runtime restore scope split into M2 backup-only, M3 archive validation/dry-run, M4 canonical local restore smoke, and Phase 2+ cross-deploy restore; parent PRD and identity audit reference synchronized.
- 2026-05-22 follow-up review after restore milestone sync captured: new findings narrowed to stale `setup-time.md` M3 restore wording and `runtime.md` Open Questions #4 now being a resolved milestone note rather than an open question.
- 2026-05-22 final cleanup captured: setup-time M3 wording synchronized with runtime restore milestone, runtime restore milestone moved to Resolved Scope Notes, and discussion marked ready for owner review.
