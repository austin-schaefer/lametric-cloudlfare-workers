# Claude Code Skills

This directory contains custom skills for Claude Code to provide specialized assistance for this project.

## Available Skills

### `/codereviewer` - Expert Code Reviewer

Comprehensive code review focused on:
- Cloudflare Workers best practices
- LaMetric Time API compliance
- Scalability and performance
- Security (secrets management)
- Catching LLM anti-patterns and lazy coding
- Comment quality (no outdated comments, no change history)

**Usage:**
```
/codereviewer src/apps/osrs.ts
```

Or simply:
```
/codereviewer
```

Then paste the code you want reviewed.

The reviewer will provide:
- Overall assessment (Good / Minor Changes / Major Changes / Do Not Merge)
- Critical issues with specific line references
- Detailed suggestions with before/after code examples
- Security and scalability concerns
- Comment quality check

### `/docs` - Documentation Maintainer

Maintains clean, focused READMEs following anti-bloat philosophy:
- Enforces file structure (one `README-<app>.md` per app)
- Reviews uncommitted changes for documentation needs
- Removes LLM bloat, overselling, and over-documentation
- Keeps docs neutral, concise, and maintainer-focused

**Usage:**
```
/docs
```

The maintainer will:
- Check file structure compliance (each app has exactly one README)
- Analyze uncommitted changes for documentation gaps
- Review README quality against best practices
- Offer to consolidate/edit files as needed
- Suggest improvements without being aggressive

### `/prdescriber` - PR Description Creator

Creates terse, focused PR descriptions (100-200 words) by comparing current branch against main:
- Analyzes functional/end-user changes
- Highlights notable technical changes
- Provides brief testing instructions
- Maintains neutral, factual tone (no marketing speak)

**Usage:**
```
/prdescriber
```

The describer will:
- Compare current branch against main
- Draft 100-200 word description covering functional changes, technical details, and testing
- Focus on impact, not implementation minutiae
- Avoid bloat, overselling, and unnecessary details

### `/shipit` - Commit, Deploy, and PR

Automates the complete workflow of committing changes, deploying to Cloudflare, and creating a pull request:
- Commits all changes with descriptive message
- Deploys to Cloudflare Workers
- Creates pull request against main
- Handles errors gracefully at each step

**Usage:**
```
/shipit "Add new feature"
```

Or without commit message (auto-generates):
```
/shipit
```

The workflow:
1. Stages and commits changes (uses provided or auto-generated message)
2. Deploys to Cloudflare with `wrangler deploy`
3. Pushes branch to remote
4. Creates PR with auto-generated description
5. Reports results with links and status

## Skill Structure

Skills follow the Claude Code skills specification:

```
.claude/skills/
└── skill-name/
    └── SKILL.md        # Required: Main skill file with YAML frontmatter
```

### Required Frontmatter Format

```yaml
---
name: skill-name
description: What this skill does and when to use it
argument-hint: [optional-args]
allowed-tools: Read, Grep, Glob
---
```

## Adding New Skills

1. Create directory: `.claude/skills/new-skill/`
2. Create file: `.claude/skills/new-skill/SKILL.md`
3. Add YAML frontmatter with `name` and `description`
4. Include clear instructions and checklists
5. Reference project-specific patterns from `CLAUDE.md`
