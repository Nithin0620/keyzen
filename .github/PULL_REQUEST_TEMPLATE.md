name: Pull request

description: Submit a change to Keyzen

body:
  - type: markdown
    attributes:
      value: |
        Thanks for contributing. Please confirm the checklist below before requesting review.

  - type: input
    id: title
    attributes:
      label: Title
      description: Use Conventional Commits, e.g. `feat(cli): add keyzen export --format env`
      placeholder: feat(cli): add keyzen export --format env
    validations:
      required: true

  - type: textarea
    id: description
    attributes:
      label: Description
      description: What changed, and why? Link any related issue with `Closes #123`.
    validations:
      required: true

  - type: dropdown
    id: type
    attributes:
      label: Type of change
      options:
        - Bug fix
        - New feature
        - Refactor / cleanup
        - Documentation
        - Build / tooling
    validations:
      required: true

  - type: checkboxes
    id: checklist
    attributes:
      label: Checklist
      options:
        - label: `pnpm lint`, `pnpm build`, and `pnpm test` pass locally
          required: true
        - label: Added or updated tests covering this change
          required: true
        - label: No secrets, keys, or `.env` files are included in the diff
          required: true
        - label: Updated documentation where behavior changed
          required: false
        - label: This change does not alter cryptographic behavior without a corresponding test
          required: false
