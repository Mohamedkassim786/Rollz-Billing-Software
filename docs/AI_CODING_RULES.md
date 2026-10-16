# ROLLZ POS — Instructions for AI Coding Assistants

Read this file and the other documents in `docs/` before changing the code.

## Project context
Build ROLLZ POS for one fast-food restaurant initially. The restaurant sells rolls, burgers, grill items, loaded fries, kebabs, beverages, and related food. The first deployment uses one Windows computer, PostgreSQL locally, and two thermal printers to be purchased later.

## Non-negotiable rules
1. Do not replace PostgreSQL with another database without explicit approval.
2. Do not assume printers have been purchased. Use a mock printer adapter until model and connection details are known.
3. The kitchen print job must not be created or dispatched before the backend confirms payment and finalizes the order.
4. Do not trust totals, discounts, taxes, item availability, or payment success sent by the frontend. Validate/recalculate on the server.
5. Never use floating-point arithmetic for money.
6. Never store plaintext passwords or secrets in source control.
7. Never silently modify finalized invoices or historic order item snapshots.
8. Never run destructive database reset/migration commands against existing data without explicit approval and a verified backup.
9. Keep core operations local-first; don't make billing depend on a cloud API or remote CDN.
10. Do not claim a feature works unless it was implemented and tested.
11. Do not invent printer model, port, payment provider, GST registration status, or restaurant prices.
12. Enforce access control in the backend.
13. Keep branch references in the data model for future expansion, but prioritize a reliable single-branch workflow.
14. Use transactions and duplicate-submission protection for payment and order finalization.
15. Do not put payment secrets or sensitive customer data in logs.

## Implementation workflow
Before editing:
- Inspect the existing project and package versions.
- Identify the current milestone.
- Read relevant project documents.
- Explain the planned files and behavior briefly.

While editing:
- Make small, coherent changes.
- Keep frontend, API, domain/business logic, and persistence concerns separated.
- Validate all incoming API payloads.
- Use database constraints for important invariants.
- Add tests for business rules and bug fixes.
- Do not create huge monolithic components or controllers.
- Keep UI components reusable but avoid premature abstraction.

After editing:
- Run type checking, linting, tests, and build commands that are available.
- Fix errors caused by the changes.
- Report exactly what changed and what was tested.
- List anything that remains incomplete.
- Never state tests passed if they were not run.

## Version compatibility
- Inspect the installed versions of Prisma and related packages before generating schema/client configuration.
- Use one consistent Prisma configuration style compatible with those versions.
- Avoid blindly copying configuration from tutorials for another major version.
- Pin or document important dependency versions when required for reproducible builds.

## Current priority
Start with Milestone 0 in `DEVELOPMENT_PLAN.md`: project structure, environment, PostgreSQL connection, Prisma setup, and health endpoint. Do not implement the entire application in one giant change.
