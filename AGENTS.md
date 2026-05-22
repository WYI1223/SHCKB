# Agent Memory

This repository is being rebuilt through PRD-first product reasoning. Agents working here must treat current PRDs and owner decisions as the source of truth.

## Mandatory Reasoning Checks

Before proposing, reviewing, or implementing architecture, technology stack, ADRs, PRDs, or implementation plans, run these checks explicitly:

1. **Reasonableness check**
   - Is the current solution actually reasonable for the current product shape?
   - "It has always been this way" is not evidence.
   - Historical ADRs, frozen docs, carryover code, and previous tool choices are hypotheses to re-evaluate, not authority.

2. **Wheel-reinvention check**
   - Is the current plan rebuilding something mature libraries or platforms already solve?
   - If yes, is there a product-specific reason to rebuild it?
   - Default to proven ecosystem tools unless the product requirements clearly justify custom work.

3. **Technology-fit check**
   - Can the proposed stack cover all current and foreseeable requirements?
   - For each uncovered requirement, decide explicitly: change stack, compose with another library, add a narrow adapter, or defer the requirement.
   - Avoid broad patches that turn a mismatched stack into an accidental framework.

4. **First-principles product check**
   - Start from user/operator/product requirements, not from historical implementation choices.
   - Prefer the simplest solution that completes the current milestone.
   - Preserve architecture compatibility and long-term maintainability where the product has credible future pressure.
   - Do not over-abstract before the product need is real.

## ADR Handling

ADR-0001 through ADR-0018 are deprecated legacy drafts. They are retained for history only.

Technology-stack decisions must be derived from current PRDs and product shape, then captured in new PRD-informed ADRs. Do not allow old ADR wording, frozen DI history, or carryover package choices to anchor new technical decisions.
