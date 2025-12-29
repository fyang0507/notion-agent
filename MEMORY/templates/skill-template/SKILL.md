---
name: your-database-name
description: Brief description of when/how to use this database
---

# Database Name

## Required Fields
List fields that MUST have values. Specify behavior when not provided.

- **Name**: Always required. Ask user if not provided.
- **Date**: Required. Use today's date if not specified.

## Optional Fields with Defaults
List fields with default values or inference rules.
Format: `- **FieldName**: [Default behavior]. [When to ask user]`

- **Tags**: Infer from content context. Ask if ambiguous.
- **Status**: Default to "Not started" for new entries.

## Workflow
Step-by-step instructions for creating entries.

1. Ensure you have the required fields (Name, Date)
2. Infer optional fields from user's request context
3. Ask user only for truly ambiguous fields
4. Create the page with all gathered properties

## Notes
Any special considerations or edge cases.

- Property names are case-sensitive (use exact names from schema)
- Multi-select fields accept arrays of tag names
- Date fields use ISO 8601 format (YYYY-MM-DD)
