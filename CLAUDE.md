# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working in this repository.

# Project Instructions

## Project Structure

Workflow artifacts go in the `docs/` directory:
- `docs/discovery/` — business process analysis outputs
- `docs/requirements/` — user stories, acceptance criteria, product requirements
- `docs/architecture/` — technical design decisions, ADRs
- `docs/testing/` — test strategy, QA checklists
- `docs/release/` — release readiness artifacts

---

## Current Stage

This project is starting from an idea.

Do not assume the architecture, framework, database, hosting platform, package manager, deployment platform, or third-party services until they are explicitly selected.

Start by understanding the business problem and process before proposing product features or technical implementation.

---

## Core Development Philosophy

This project follows a fully agentic development process.

Agents should not jump directly from an idea to code. New work should move through discovery, product analysis, design, implementation, testing, review, security, documentation, and release readiness.

The goal is to create small, thoughtful, reviewable increments that are grounded in real business needs.

---

## Development Principles

- Start with business goals before implementation.
- Clarify vague ideas before creating user stories.
- Understand the current process before designing the future process.
- Prefer an MVP before advanced features.
- Make small, reviewable changes.
- Explain major tradeoffs before choosing a direction.
- Do not introduce frameworks, services, databases, hosting platforms, package managers, or dependencies without explaining why.
- Keep code simple, maintainable, and testable.
- Do not create fake production readiness.
- Clearly label assumptions, risks, gaps, and open questions.
- Do not invent requirements. If something is unknown, mark it as an open question or assumption.
- Do not begin implementation until the business process, user story, acceptance criteria, and technical approach are clear enough to build.

---

## Agentic Development Workflow

For all new work, especially vague ideas or business-process-heavy requests, follow this sequence:

1. Business process discovery
2. Product analysis
3. User story and acceptance criteria creation
4. UX, workflow, or screen design when needed
5. Technical design options
6. MVP architecture selection
7. Architecture decision records when major decisions are made
8. Project scaffolding
9. One vertical slice implementation
10. Test creation or test updates
11. Code review
12. Security review
13. Documentation update
14. Release readiness check

---

## Agent Responsibilities

> Each agent below has a corresponding spec file in `.claude/agents/`. Claude Code will
> delegate to these sub-agents automatically when the task matches their description.

### 1. Business Process Specialist

Use the `business-process-specialist` agent first when a request starts as a vague idea, business need, workflow problem, automation request, intake process, reporting need, Power Apps request, Jira/JSM process, or system improvement idea.

This agent is responsible for requirements discovery before product or technical work begins.

The Business Process Specialist should clarify:

- The business problem
- The current process
- The desired future process
- Primary users and stakeholders
- Who starts the process
- Who reviews, approves, assigns, completes, or monitors the work
- Required inputs and data
- Workflow steps
- Statuses
- Business rules
- Exceptions and edge cases
- Notifications
- Reporting and dashboard needs
- Risks, constraints, and dependencies
- Open questions

The Business Process Specialist should ask clarifying questions and elicit thoughtful input from the user before producing requirements.

It should not jump directly to architecture, tools, database design, or implementation.

Expected outputs may include:

- Clarifying questions
- Current-state process
- Future-state process
- Actors and stakeholders
- Trigger
- Inputs
- Workflow
- Statuses
- Business rules
- Notifications
- Reporting needs
- Assumptions
- Risks
- Open questions

Use this agent when the user says things like:

- “I need a system for tracking requests.”
- “We want to automate this process.”
- “Can we build this in Power Apps?”
- “I need Jira to manage intake.”
- “We need a dashboard.”
- “Users should submit tickets.”
- “I want to make this process better.”
- “I have an idea for an app.”

The goal of this agent is to turn a vague business need into a clear, structured business process.

---

### 2. Product Analyst

Use the Product Analyst after the Business Process Specialist has clarified the business problem and process.

The Product Analyst is responsible for turning the refined business process into product requirements.

The Product Analyst should produce:

- Product goals
- User personas or user groups
- User value
- Epics
- Features
- User stories
- Acceptance criteria
- MVP scope
- Out-of-scope items
- Prioritization recommendations
- Product risks
- Open product questions

The Product Analyst should not invent process details that were not discovered. Unknowns should remain open questions.

---

### 3. UX / Workflow Designer

Use a UX or Workflow Designer when the feature requires screens, forms, role-based views, dashboards, status changes, or user journeys.

This agent should define:

- User journeys
- Screen list
- Form fields
- Required and optional fields
- Role-based views
- Workflow states
- Happy paths
- Exception paths
- Empty states
- Error states
- Confirmation messages
- Basic usability considerations

This agent should work from the clarified business process and product requirements.

---

### 4. Technical Design Agent

Use the Technical Design Agent after the business process, product requirements, and MVP scope are clear.

This agent is responsible for proposing technical approaches, not immediately choosing one without explanation.

The Technical Design Agent should provide:

- Technical design options
- Tradeoffs
- Recommended MVP architecture
- Data model options
- API or integration approach
- Authentication and authorization considerations
- Deployment considerations
- Dependency recommendations
- Risks and constraints
- Open technical questions

Do not assume a framework, database, cloud provider, hosting platform, or package manager unless it has been selected.

---

### 5. ADR Agent

Use the ADR Agent when a major technical decision is made.

Create Architecture Decision Records for decisions such as:

- Framework selection
- Database selection
- Hosting platform selection
- Authentication approach
- Integration approach
- API architecture
- Monolith vs. service-based design
- Build tooling
- Deployment strategy

Each ADR should include:

- Context
- Decision
- Options considered
- Consequences
- Tradeoffs
- Date
- Status

---

### 6. Implementation Agent

Use the Implementation Agent only after the requirements and technical approach are clear enough to build.

The Implementation Agent should:

- Implement one vertical slice at a time.
- Keep changes small and reviewable.
- Follow project conventions.
- Avoid unnecessary abstractions.
- Avoid introducing new dependencies without justification.
- Include or update tests when appropriate.
- Clearly document assumptions and limitations.

The Implementation Agent should not expand scope without approval.

---

### 7. Test Engineer

Use the Test Engineer after or during implementation.

The Test Engineer should create or update:

- Unit tests
- Integration tests
- Workflow tests
- Validation tests
- Edge case tests
- Regression tests
- Manual QA checklists when automated tests are not practical

Tests should map back to acceptance criteria whenever possible.

---

### 8. Code Reviewer

Use the Code Reviewer before considering a feature complete.

The Code Reviewer should check for:

- Correctness
- Maintainability
- Simplicity
- Readability
- Duplication
- Naming
- Error handling
- Test coverage
- Missed edge cases
- Consistency with project conventions
- Alignment with acceptance criteria

The reviewer should identify issues clearly and recommend practical fixes.

---

### 9. Security Reviewer

Use the Security Reviewer for every feature that involves user input, authentication, authorization, stored data, third-party services, file uploads, payments, administrative actions, or sensitive information.

The Security Reviewer should check:

- Secrets handling
- Authentication
- Authorization
- Input validation
- Output encoding
- File upload risks
- Data exposure
- Logging risks
- Error message leakage
- Dependency risks
- Audit needs
- Abuse cases

Authentication, authorization, payments, secrets, and user data are high-risk areas.

---

### 10. Documentation Agent

Use the Documentation Agent before a feature is considered done.

The Documentation Agent should update:

- README files
- Setup instructions
- Environment variable documentation
- API documentation
- User workflow documentation
- Developer notes
- Architecture notes
- Known limitations
- CLAUDE.md when project conventions change

Documentation should reflect the current project state, not an idealized future state.

---

### 11. DevOps / Release Agent

Use the DevOps or Release Agent when preparing a feature for deployment or release.

This agent should check:

- Environment variables
- Build commands
- Test commands
- CI/CD configuration
- Deployment steps
- Rollback approach
- Logging
- Monitoring
- Release notes
- Known limitations
- Manual verification steps

The release process should not claim production readiness unless the project actually meets production readiness expectations.

---

## Required Workflow for New Work

For new work, follow this sequence:

1. Clarify the business process with the Business Process Specialist.
2. Define users, stakeholders, and business value.
3. Create user stories and acceptance criteria.
4. Define UX, workflow, screens, or forms if needed.
5. Propose technical design options.
6. Select an MVP architecture.
7. Record major architecture decisions when needed.
8. Scaffold the project or feature.
9. Implement one vertical slice.
10. Add or update tests.
11. Review code.
12. Review security.
13. Update documentation.
14. Check release readiness.

---

## Business Process Discovery Gate

Before creating user stories or technical designs, confirm that the following are understood:

- What business problem are we solving?
- How does the process work today?
- What is broken, slow, manual, confusing, risky, or inefficient?
- Who starts the process?
- Who owns the process?
- Who approves or reviews the work?
- Who completes the work?
- What information must be collected?
- What systems, tools, forms, emails, or spreadsheets are involved today?
- What statuses should the work move through?
- What business rules affect routing, approval, priority, assignment, or completion?
- What exceptions must be handled?
- What notifications are needed?
- What reporting or dashboard needs exist?
- What does success look like?

If these answers are not known, ask clarifying questions before proceeding.

---

## Product Requirements Gate

Before technical design begins, confirm that the following are available:

- Product goal
- User groups
- User value
- MVP scope
- User stories
- Acceptance criteria
- Out-of-scope items
- Assumptions
- Open questions

If these are incomplete, return to business process discovery or product analysis.

---

## Technical Design Gate

Before implementation begins, confirm that the following are available:

- Selected MVP architecture
- Technical design summary
- Data model or data storage approach
- API or integration approach, if needed
- Authentication and authorization approach, if needed
- Testing approach
- Known technical risks
- Dependencies and why they are needed
- Open technical questions

If these are incomplete, do not begin implementation.

---

## Implementation Rules

When implementing:

- Build one vertical slice at a time.
- Keep each change focused.
- Prefer clear code over clever code.
- Avoid premature abstraction.
- Validate input at trust boundaries.
- Handle errors intentionally.
- Do not swallow exceptions silently.
- Do not add dependencies without explaining why.
- Do not change unrelated files unless necessary.
- Do not expand scope without stating the reason.
- Add or update tests where appropriate.
- Update documentation when behavior, setup, or architecture changes.

---

## Definition of Done

A feature is done when:

- The business process impact is understood.
- Acceptance criteria are satisfied.
- Relevant tests are added or updated.
- Code follows project conventions.
- Security risks have been considered.
- Documentation is updated where needed.
- Known limitations are documented.
- Open questions are either resolved or explicitly recorded.
- Release readiness has been checked.

---

## Safety and Security

- Never commit secrets, tokens, passwords, private keys, credentials, or sensitive configuration.
- Use environment variables for sensitive configuration.
- Validate input at trust boundaries.
- Treat authentication, authorization, payments, administrative actions, file uploads, and user data as high-risk areas.
- Avoid exposing sensitive information in logs, error messages, screenshots, commits, or documentation.
- Do not store credentials in source control.
- Do not fake security or production readiness.
- Clearly document security assumptions and unresolved risks.

---

## Assumptions and Open Questions

When information is missing, use this format:

```markdown
## Assumptions

- [Assumption that is currently being made]

## Open Questions

- [Question that still needs an answer]

## Risks

- [Risk created by the assumption or unknown]
```

Do not hide uncertainty.

---

## Preferred Handoff Format Between Agents

When one agent finishes its work, it should produce a clear handoff for the next agent.

### Business Process Specialist Handoff

```markdown
## Refined Business Process

## Business Problem

## Current State

## Future State

## Actors and Stakeholders

## Trigger

## Inputs

## Workflow

## Statuses

## Business Rules

## Notifications

## Reporting Needs

## Assumptions

## Risks

## Open Questions
```

### Product Analyst Handoff

```markdown
## Product Goal

## Users

## User Value

## MVP Scope

## Epics

## User Stories

## Acceptance Criteria

## Out of Scope

## Assumptions

## Open Questions
```

### Technical Design Handoff

```markdown
## Recommended MVP Architecture

## Options Considered

## Tradeoffs

## Data Model

## API or Integration Design

## Authentication and Authorization

## Testing Strategy

## Risks

## Dependencies

## Open Questions
```

### Implementation Handoff

```markdown
## Changes Made

## Files Changed

## How to Test

## Tests Added or Updated

## Known Limitations

## Follow-Up Work
```

---

## Final Instruction

Do not rush to code.

For vague ideas, begin with the Business Process Specialist.

Clarify the business process first, then define the product, then design the technical approach, then implement one small vertical slice.
