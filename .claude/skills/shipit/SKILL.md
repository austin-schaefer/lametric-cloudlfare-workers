---
name: shipit
description: Commits changes, deploys to Cloudflare, and creates a pull request
argument-hint: "[optional-commit-message]"
allowed-tools: Read, Bash, AskUserQuestion
---

# Ship It - Commit, Deploy, and PR

Automates the workflow of committing changes, deploying to Cloudflare, and creating a pull request.

## What This Does

1. **Commits** all changes with a descriptive message
2. **Deploys** to Cloudflare Workers
3. **Creates** a pull request against main

## Process

### Step 1: Check Status

```bash
# Check current branch
git branch --show-current

# Check for uncommitted changes
git status --short

# Get recent commits to understand commit style
git log -3 --oneline
```

**If no changes to commit:**
- Skip to deployment if already committed
- If nothing new, ask user if they still want to deploy/PR

**If on main branch:**
- Warn user and ask if they want to create a feature branch first

### Step 2: Commit Changes

**If commit message provided as argument:**
- Use the provided message directly

**If no commit message:**
- Analyze the changes using git diff
- Draft a concise commit message (50-70 chars)
- Follow this repo's style (look at git log)
- Format: "Verb noun phrase" (e.g., "Add stocks app", "Fix rate limiting")

**Commit process:**
```bash
# Stage relevant files (prefer specific files over 'git add -A')
git add <specific-files>

# Create commit with co-authored-by
git commit -m "$(cat <<'EOF'
<commit message>

Co-Authored-By: Claude Sonnet 4.5 <noreply@anthropic.com>
EOF
)"

# Verify commit succeeded
git status
```

**CRITICAL - Git Safety:**
- NEVER use --no-verify or skip hooks
- NEVER amend commits unless explicitly requested
- If pre-commit hook fails, fix the issue and create a NEW commit
- Prefer staging specific files over `git add -A`

### Step 3: Deploy to Cloudflare

```bash
wrangler deploy
```

**Monitor the deployment:**
- Check that bindings are correct
- Note the deployed URL
- Watch for any deployment errors

**If deployment fails:**
- Report the error to user
- Ask if they want to continue with PR anyway
- Don't abort the entire workflow

### Step 4: Create Pull Request

**Prepare PR:**
```bash
# Check if branch has remote tracking
git branch -vv

# Get commit history for PR
git log main..HEAD --oneline

# Get full diff for PR description
git diff main...HEAD --stat
```

**Push and create PR:**
```bash
# Push to remote (with -u if needed)
git push -u origin <branch-name>

# Create PR with title and description
gh pr create --title "<title>" --body "$(cat <<'EOF'
## Summary
- <bullet points of changes>

## Test plan
- [ ] <testing steps>

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**PR Title Guidelines:**
- Keep under 70 characters
- Use imperative mood ("Add", "Fix", "Update")
- Be specific (name the feature/fix)

**PR Description Guidelines:**
- Summary: 2-4 bullet points of key changes
- Test plan: Actionable testing steps with checkboxes
- Keep it concise and focused

### Step 5: Report Results

Provide a summary:
```
✓ Committed: <commit-sha> <commit-message>
✓ Deployed: <worker-url>
✓ PR created: <pr-url>
```

## Examples

### Example 1: With commit message argument

```bash
/shipit "Add stocks app for S&P 500 tracking"
```

**What happens:**
1. Stages relevant files
2. Commits with message "Add stocks app for S&P 500 tracking"
3. Deploys to Cloudflare
4. Creates PR with auto-generated description

### Example 2: No arguments (auto-generate commit message)

```bash
/shipit
```

**What happens:**
1. Analyzes git diff
2. Generates commit message like "Add stoxx app and update documentation"
3. Deploys to Cloudflare
4. Creates PR with description based on changes

### Example 3: Already committed, just deploy and PR

```bash
/shipit
```

**If working tree is clean:**
1. Asks: "No changes to commit. Deploy and create PR?"
2. If yes: deploys and creates PR
3. If no: exits

## Edge Cases

**On main branch:**
- Warn: "You're on main. Create a feature branch first?"
- If yes: ask for branch name, create branch, then proceed
- If no: exit (don't commit to main directly)

**Remote branch exists:**
- Use `git push` without `-u` flag
- Continue normally

**Pre-commit hook fails:**
- Display the error
- Fix the issue (if possible)
- Re-stage files
- Create a NEW commit (not amend)

**No ENABLED_APPS in wrangler.toml:**
- Continue normally (all apps enabled by default)

**PR already exists for branch:**
- gh will show error
- Report to user: "PR already exists for this branch"
- Still show deployment success

**Secrets not configured:**
- Deployment succeeds but worker may not function
- Remind user to set secrets: `wrangler secret put <KEY_NAME>`

## Configuration Requirements

**Required:**
- Git repository with remote
- `wrangler` CLI installed and authenticated
- `gh` CLI installed and authenticated
- Branch should not be `main`

**Optional:**
- Commit message as argument

## Remember

- Always use heredoc format for commit messages
- Never skip git hooks
- Deploy even if tests fail (user can decide)
- Create PR even if deployment fails (user can decide)
- Be concise in all messages and descriptions
- Trust the user to read the output
