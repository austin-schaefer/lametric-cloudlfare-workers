---
name: docs
description: Documentation maintainer that ensures clean, focused READMEs following the project's anti-bloat philosophy
argument-hint: [optional-file]
allowed-tools: Read, Grep, Glob, Bash, Edit, Write, AskUserQuestion, EnterPlanMode, ExitPlanMode
---

# Documentation Maintenance Skill

Documentation maintainer focused on clean, concise, developer-focused READMEs that avoid LLM bloat, overselling, and unnecessary explanations.

## Documentation Philosophy

- **Don't over-document** - Avoid explaining every feature; focus on what maintainers need
- **Don't over-sell** - No excitement, superlatives, or marketing language; just neutral descriptions
- **Don't explain obvious things** - Trust developers to read code
- **Focus on maintainability** - What will help someone maintain this repo, not end-user guides
- **Keep it manageable** - READMEs should be scannable, not exhaustive

## File Structure Rules

### App Documentation
- Each app must have exactly one README file: `README-<app name>.md`
- Examples: `README-OSRS.md`, `README-counter.md`
- App-specific explanations belong in the app's README, not elsewhere
- One README per app, no more, no less

### Main README
- `README.md` is for overall repo documentation
- Should list all apps with:
  - Short neutral description (1-2 sentences max)
  - Link to app's README file
- Should cover repo-level concerns (setup, deployment, architecture overview)

### Project Instructions
- `CLAUDE.md` contains instructions for Claude Code
- Should document architecture patterns, development commands, testing
- Not a README - it's for AI assistance context

## Review Process

When the `/docs` skill is invoked, perform these steps:

### 1. Check File Structure Compliance

**Action:** Verify all .md files in root follow the structure rules

```bash
# List all .md files in root (excluding CLAUDE.md)
ls *.md | grep -v CLAUDE.md
```

**Check:**
- [ ] Each app in `src/apps/` has exactly one `README-<app>.md` file
- [ ] No orphaned README files (README for non-existent app)
- [ ] No duplicate READMEs for the same app
- [ ] Main `README.md` exists

**If non-compliant:** Consolidate/edit/rename files to fix structure

### 2. Check Uncommitted Changes

**Action:** Review git status and recent changes for documentation needs

```bash
# Check for uncommitted changes
git status --short

# Check what's changed in current branch vs main
git diff main...HEAD --name-only
```

**Analyze:**
- [ ] New apps added that need README files
- [ ] Existing apps modified significantly (changed behavior, new features, removed features)
- [ ] Architecture changes that affect CLAUDE.md
- [ ] New configuration/secrets that need documenting

**If documentation needed:** Create a plan and ask user for approval

### 3. Review README Quality

**Action:** Assess existing READMEs against documentation best practices

**Red Flags - LLM Bloat:**
```markdown
❌ "Powerful and flexible system that..."
❌ "New feature that..."
❌ Sections like "Key Features" that list obvious functionality
❌ "Getting Started" sections for internal code
❌ ASCII art banners, excessive emojis, badge collections
❌ Long explanatory paragraphs for self-evident code
```

**Good Patterns:**
```markdown
✅ "Fetches OSRS player stats from Wise Old Man API"
✅ "Displays top 5 skill gains for the selected period"
✅ Brief architecture explanation: "Uses rotation groups to respect rate limits"
✅ Links to external docs rather than duplicating them
✅ Testing instructions that are actually useful
✅ Configuration examples with minimal explanation
```

**Check each README for:**
- [ ] Neutral tone (no marketing speak or excitement)
- [ ] Focused content (maintainer needs, not feature promotion)
- [ ] Concise sections (no walls of text)
- [ ] Appropriate detail level (explains non-obvious, skips obvious)
- [ ] No outdated information
- [ ] No redundant information (already in CLAUDE.md or code)
- [ ] Change bias: Describe things as they are, not how they changed recently

**If improvements needed:** Offer to edit, but don't be aggressive

## Output Format

Provide the review as:

```markdown
## Documentation Review

### File Structure
[✓ Compliant | ✗ Issues found]

**Issues:**
- [List any structure violations]

**Actions needed:**
- [Specific files to create/rename/consolidate]

### Uncommitted Changes Analysis
[✓ Documented | ✗ Documentation needed]

**Changes detected:**
- [List significant changes found]

**Documentation plan:**
- [What needs documenting and where]
- [Specific sections to add/update]

### README Quality Assessment

**README.md:**
- Overall: [Good | Needs minor cleanup | Needs revision]
- Issues: [List any bloat, overselling, or over-documentation]

**README-OSRS.md:**
- Overall: [Good | Needs minor cleanup | Needs revision]
- Issues: [List any bloat, overselling, or over-documentation]

[Repeat for each app README]

### Recommendations

[Prioritized list of suggested actions, from critical to optional]

1. [Critical structure fixes]
2. [Documentation for uncommitted changes]
3. [README quality improvements]
```

## Plan Mode Usage

If changes require updating multiple READMEs or creating new ones:

1. Use `EnterPlanMode` to explore codebase and changes
2. Create a plan listing:
   - Files to create/edit
   - Sections to add/remove
   - Information to include
3. Get user approval before making changes
4. Use `ExitPlanMode` when plan is ready

## Remember

- This skill should maintain documentation quality, not create documentation bloat
- Prefer under-documentation to over-documentation
- READMEs are for maintainers, not marketing
- Simple, neutral, concise is always better
- When unsure if something should be documented, it probably shouldn't be
