---
name: issue-garbage-collector
description: Two-phase cleanup of duplicate and outdated issue files in docs/issues/. Phase 1 uses Python script for fast pattern matching. Phase 2 uses claude -p for semantic analysis on suspects only.
when_to_use: When the issues directory becomes cluttered, after resolving multiple issues, or as periodic maintenance (weekly during active development, monthly otherwise).
version: 1.2.0
---

## Quick Start

```bash
# Phase 1: Run Python scanner (fast, free)
python3 scripts/issue-scanner.py

# Phase 1: Get suspects only (for Phase 2 input)
python3 scripts/issue-scanner.py --suspects-only

# Phase 1: JSON output (for automation)
python3 scripts/issue-scanner.py --json

# Phase 1: Validation check (CI integration, exit 1 if errors)
python3 scripts/issue-scanner.py --check
```

---

## Two-Phase Strategy (Cost Optimization)

**Problem**: Running deep AI analysis on every issue is expensive.

**Solution**: Two-phase approach:
1. **Phase 1 (Fast/Free)** — Python script for pattern matching
2. **Phase 2 (Deep/Expensive)** — `claude -p` only on suspects

```
┌─────────────────────────────────────────────────────────┐
│  All Issues (N files)                                   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Phase 1: Python Scanner (scripts/issue-scanner.py)│  │
│  │ - Filename keyword extraction                     │  │
│  │ - YAML front-matter validation                    │  │
│  │ - Same area + keyword overlap detection           │  │
│  │ - Age-based staleness check                       │  │
│  │ → Output: Suspect list (M files, M << N)          │  │
│  └───────────────────────────────────────────────────┘  │
│                         ↓                               │
│  ┌───────────────────────────────────────────────────┐  │
│  │ Phase 2: Deep Analysis (claude -p, only M files)  │  │
│  │ - Content similarity                              │  │
│  │ - Semantic duplicate detection                    │  │
│  │ - Merge recommendations                           │  │
│  └───────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

---

## Phase 1: Python Scanner

Run `python3 scripts/issue-scanner.py` to get:

### 1.1 Formatted Table View

```
====================================================================================================
📋 ISSUE SCANNER REPORT
====================================================================================================

📊 ISSUE TABLE:
----------------------------------------------------------------------------------------------------
Status       Sev  Date         Area               Title
----------------------------------------------------------------------------------------------------
✅ resolv     🟠    2026-03-02   background-worker  HMR 导致 sessionToTask 内存 Map 丢失
🔴 open       🟡    2026-03-04   ui                 Task Execute button disabled
...
----------------------------------------------------------------------------------------------------
Total: 12 issues

📈 SUMMARY BY STATUS:
  🔴 open: 5
  ✅ resolved: 7
```

### 1.2 Validation Errors

If any issue has malformed front-matter, the scanner reports:

```
❌ VALIDATION ERRORS (need AI fix):
------------------------------------------------------------
  2026-03-08-broken-issue.md:
    - Missing required field: area
    - Invalid status: pending (valid: ['open', 'investigating', 'resolved', 'wontfix', 'duplicate'])
```

**Action**: Ask AI to fix the file:
```bash
claude -p "Fix the front-matter in docs/issues/2026-03-08-broken-issue.md. Add missing 'area' field and change status to a valid value."
```

### 1.3 Suspect Detection

The scanner automatically detects:

| Type | Detection Rule | Example |
|------|----------------|---------|
| **Duplicate** | Same area + ≥2 common keywords | `hmr-task` vs `task-hmr-recovery` |
| **Stale** | `open` > 30 days | Issue from 2026-01-15 still open |
| **Stale** | `investigating` > 14 days | Stuck investigation |

Output:
```
⚠️  SUSPECTS (need Phase 2 deep analysis):
------------------------------------------------------------

  🔗 Potential Duplicates:
    - 2026-03-02-hmr-resets-session-to-task-map.md
      ↔ 2026-03-08-background-task-hmr-recovery.md
      Reason: Same area 'background-worker', keywords: {'task', 'hmr'}

  ⏰ Stale Issues:
    - 2026-02-01-old-bug.md: Open for 35 days (>30)
```

### 1.4 JSON Output for Automation

```bash
# Get suspects as JSON for scripting
python3 scripts/issue-scanner.py --suspects-only
```

Output:
```json
[
  {
    "file_a": "2026-03-02-hmr-resets-session-to-task-map.md",
    "file_b": "2026-03-08-background-task-hmr-recovery.md",
    "reason": "Same area 'background-worker', keywords: {'task', 'hmr'}",
    "type": "duplicate"
  }
]
```

---

## Phase 2: Deep Analysis (claude -p)

Only run on suspects from Phase 1. This saves cost.

### When to Use claude -p

| Suspect Type | Example Command |
|--------------|-----------------|
| Duplicate | `claude -p "Check if these two issues are duplicates and merge if confirmed: docs/issues/A.md docs/issues/B.md"` |
| Open | `claude -p "Check if this open issue has been resolved: docs/issues/X.md"` |
| Stale | `claude -p "Triage this stale issue - close, escalate, or archive: docs/issues/Y.md"` |

### AI Judgment Rules

When AI receives a Phase 2 request, it should:

1. **Read the issue file(s)** — understand the problem described
2. **Check Relevant Files** — verify if referenced code still exists
3. **Look for fixes** — search recent commits or code changes
4. **Make a judgment**:
   - For duplicates: DUPLICATE / RELATED / DISTINCT
   - For open issues: RESOLVED / STILL_OPEN / NEEDS_INFO
   - For stale issues: CLOSE / ESCALATE / ARCHIVE
5. **Ask before modifying** — show diff, wait for approval

### Safety Rules

1. **Never delete `_template.md`**
2. **Never delete issues with `status: investigating`** — active work
3. **Always ask for confirmation** before any deletion or merge
4. **Show diff before changes** — let human verify
5. **Preserve knowledge** — resolved issues are valuable

---

## Periodic Maintenance

| Frequency | Action |
|-----------|--------|
| After adding issues | Run `python3 scripts/issue-scanner.py` |
| Weekly (active dev) | Full scan + Phase 2 on suspects |
| Monthly (stable) | Full scan + triage all open issues |

---

## Cost Optimization

| Approach | Deep Analysis | Cost |
|----------|---------------|------|
| Naive (all) | N files | 💰💰💰💰💰 |
| Two-phase | ~M suspects (M << N) | 💰 |

**Savings**: ~90% cost reduction by filtering in Phase 1.

