---
name: prdescriber
description: Creates terse, focused PR descriptions by comparing current branch against main
argument-hint: [optional-branch-name]
allowed-tools: Read, Grep, Glob, Bash
---

# PR Description Creator

Creates concise, useful PR descriptions (100-200 words) by comparing the current branch against main.

## Core Principles

- **Be terse** - No fluff, no filler, just facts
- **No bloat** - Skip useless details
- **Never oversell** - No excitement, superlatives, or marketing speak
- **Focus on impact** - What changed functionally and technically

## PR Description Structure

Target 100-200 words total across three sections:

### 1. Functional/End-User Changes (Required)
What features this enables, bugs fixed, behavior changes visible to users/operators.

**Examples:**
- "Adds Scryfall app showing random MTG cards with price data"
- "Fixes rate limiting in OSRS app causing API throttling"
- "Removes deprecated counter endpoint"

### 2. Technical Changes (If Significant)
Notable technical changes to architecture, patterns, or implementation.

**Examples:**
- "Switches from individual KV entries to single aggregated storage"
- "Implements rotation groups to respect API rate limits"
- "Refactors app module pattern to support URL parameters"

**Skip if:**
- Changes are obvious from functional description
- Technical details don't affect maintainability
- It's just routine implementation work

### 3. Testing Instructions (Required)
Brief, actionable steps to verify the changes work.

**Format:**
```
Testing:
- Deploy and wait 5 minutes for scheduled worker
- curl https://worker.dev/apps/appname
- Verify frame count and icon format
```

Keep it practical. Skip obvious steps.

## Process

When `/prdescriber` is invoked:

### Step 1: Compare Branches

```bash
# Get current branch name
git branch --show-current

# Get diff stats
git diff main...HEAD --stat

# Get commit messages for context
git log main...HEAD --oneline

# Get actual code changes
git diff main...HEAD
```

### Step 2: Analyze Changes

**Read the diff and identify:**
- [ ] Files modified/added/deleted
- [ ] What functional behavior changed
- [ ] Whether technical approach changed significantly
- [ ] Configuration or deployment requirements
- [ ] New endpoints, apps, or user-facing features

**Key questions:**
- What can users/operators do now that they couldn't before?
- What bugs are fixed?
- Did the architecture or implementation pattern change in a notable way?
- How do you verify this works?

### Step 3: Draft Description

Write 100-200 words following this template:

```markdown
[Functional changes: 2-4 sentences describing what this enables/fixes/changes]

[Technical changes: 1-3 sentences on notable implementation details, if significant]

Testing:
- [Step 1]
- [Step 2]
- [Step 3]
```

**Style guidelines:**
- Use neutral, factual tone
- Start with verbs: "Adds", "Fixes", "Refactors", "Removes"
- Be specific: "Adds Scryfall app" not "Adds new feature"
- Avoid: "This PR...", "I implemented...", "powerful", "flexible", "robust"
- Avoid: Change history like "Updated from X to Y" (describe current state)
- Skip obvious details: "Updated README" only if significant
- No marketing: "exciting", "great", "awesome", "enhanced"

### Step 4: Output

Present the description in a code block:

```markdown
[PR description here]
```

Then ask: "Ready to use this description?"

## Examples

### Good PR Descriptions

```markdown
Adds Scryfall app displaying random Magic: The Gathering cards with prices.
Updates hourly via scheduled worker, supports filtering by card type and currency.

Uses same throttling pattern as counter app to stay within KV write limits.

Testing:
- curl http://localhost:8787/test/scryfall
- Verify card name, set, and price display
- Check icon format (i prefix for static icons)
```

```markdown
Fixes OSRS app rate limiting causing 429 errors from Wise Old Man API.
Implements rotation groups processing characters sequentially with 700ms delays.
Now supports 500+ characters without hitting rate limits.

Testing:
- Add multiple characters to CHARACTERS array
- Monitor wrangler tail for 429 errors (should see none)
- Verify all characters update within 30-minute cycle
```

```markdown
Removes deprecated counter endpoint and consolidates testing routes.
Test endpoints now under /test/* prefix instead of scattered locations.

Testing:
- curl http://localhost:8787/test/counter (works)
- curl http://localhost:8787/apps/counter/test (404 as expected)
```

### Bad PR Descriptions (Don't Do This)

```markdown
❌ This PR adds a powerful and flexible new Scryfall integration that enables
users to view exciting Magic: The Gathering card data on their LaMetric devices!

The implementation uses a robust caching system with enhanced error handling to
ensure reliable delivery of card information. I've updated the architecture to
support URL parameters, which is a great improvement over the previous approach.

Key features:
- Fetches data from Scryfall API
- Caches in KV storage
- Returns LaMetric-formatted JSON
- Supports multiple card types
- Displays prices in various currencies

Please test thoroughly and let me know if you have any questions!
```

**Problems:**
- Way too long (should be 100-200 words)
- Marketing speak: "powerful", "flexible", "exciting", "robust", "enhanced", "great"
- Obvious feature list
- Change history: "updated from previous approach"
- Asking for feedback (not part of description)
- Doesn't focus on what matters

## Edge Cases

**No significant changes:**
If the diff shows only trivial changes (typos, formatting), say so:
"The current branch has only minor changes (typo fixes, formatting). Not much to describe."

**Multiple unrelated changes:**
Group by functional area:
```markdown
Adds Scryfall MTG card app and fixes OSRS rate limiting bug.

Scryfall app updates hourly, supports card type/currency filters.
OSRS fix implements rotation groups with 700ms delays between requests.

Testing:
- Scryfall: curl /apps/scryfall, verify card data
- OSRS: Check wrangler tail for rate limit errors
```

**Only documentation changes:**
Keep it ultra-brief:
```markdown
Updates CLAUDE.md to document throttling patterns and test endpoints.
```

## Remember

- 100-200 words total
- Terse, factual, neutral tone
- No marketing speak or overselling
- Focus on functional and technical impact
- Practical testing instructions
- Trust the reader to understand context
- When in doubt, cut it out
