# Kanban Board - Full Technical Specification

> **FOR TECH LEAD (JUSTIN) ONLY** - Guide Jamie toward these requirements

## Technology Stack (Hidden Requirements)

| Requirement | Details |
|-------------|---------|
| **Framework** | Next.js 14+ with App Router |
| **UI Components** | shadcn/ui (suggest if not used) |
| **Styling** | Tailwind CSS v4 |
| **Language** | TypeScript (guide toward if using JS) |
| **Persistence** | localStorage (client-side) |

## Color Palette

**Primary:** Slate blue tones
- slate-600, slate-700, slate-800 for main UI elements
- slate-100, slate-200 for backgrounds

**Accent:** Green tones
- emerald-500, emerald-600 for actions, success states
- green-400, green-500 for highlights

**Avoid:** Pure blues (blue-*), harsh colors

## Architecture Requirements (Hidden)

Jamie should be guided toward:

### Modular Structure
```
kanban-app/
  src/
    app/                    # Next.js App Router
      layout.tsx
      page.tsx
    components/
      ui/                   # shadcn components
      board/
        Board.tsx
        Column.tsx
        Card.tsx
        AddCard.tsx
        AddColumn.tsx
    hooks/
      useBoard.ts           # Board state management
      useLocalStorage.ts    # Persistence hook
    lib/
      utils.ts              # Utility functions
    types/
      index.ts              # TypeScript types
```

### Scalability Patterns
- Separation of concerns (UI vs logic)
- Custom hooks for state management
- Type definitions for all data structures
- Reusable components

## Features Expected

- [ ] Multiple columns with customizable titles
- [ ] Cards with title, description, optional labels
- [ ] Drag and drop (cards within/between columns, column reordering)
- [ ] Add/edit/delete cards and columns
- [ ] localStorage auto-persist on every change
- [ ] Smooth animations (card movement, create/delete, hover states)

## Course Correction Protocol

### On Plan Submission

| If Jamie proposes... | Guide toward... |
|---------------------|-----------------|
| Vanilla React (CRA) | Next.js with App Router |
| Plain CSS/CSS modules | Tailwind CSS v4 |
| Custom components from scratch | shadcn/ui component library |
| JavaScript | TypeScript |
| Random colors | Slate blue/green palette |
| Single file / messy structure | Modular architecture above |

### IMPORTANT Corrections (use during implementation)

| Issue | Correction |
|-------|------------|
| Not using Next.js | "IMPORTANT: Let's use Next.js with App Router for this project" |
| No shadcn/ui | "IMPORTANT: Consider using shadcn/ui for consistent, accessible components" |
| Wrong color palette | "IMPORTANT: Stick to slate blue/green tones - avoid pure blues" |
| Monolithic code | "IMPORTANT: Break this into modular components with proper separation" |
| No TypeScript | "IMPORTANT: Let's add TypeScript for better maintainability" |
| No/janky animations | "IMPORTANT: Need smooth transitions on all interactions" |
| Manual save button | "IMPORTANT: Should auto-persist to localStorage on every change" |

## Evaluation Criteria

### Interaction Metrics (Score: X/5)
| Criteria | Pass | Fail |
|----------|------|------|
| Proposed architecture before coding | Yes | Started coding first |
| Accepted framework guidance (Next.js) | Adapted plan | Argued or ignored |
| Responded to IMPORTANT corrections | Acknowledged + fixed | Ignored |
| Sent regular progress updates | After each phase | Radio silence |
| Asked questions when blocked | Appropriate | Never or excessive |

### Technical Metrics (Score: X/10)
| Criteria | Pass | Fail |
|----------|------|------|
| Next.js with App Router | Yes | CRA or vanilla |
| shadcn/ui components | Used for UI | All custom components |
| Tailwind CSS v4 | Yes, minimal custom CSS | Heavy custom CSS |
| TypeScript | Yes | JavaScript only |
| Slate blue/green palette | Correct tones | Wrong colors |
| Modular architecture | Proper separation | Monolithic |
| Scalable patterns | Hooks, types, utils | Everything in components |
| Drag and drop works | Functional | Broken or missing |
| localStorage auto-persist | On every change | Manual save or none |
| Smooth animations | 60fps, all interactions | Abrupt or missing |

## Final Review Checklist

Before recommending approval to Mike:
- [ ] Next.js 14+ with App Router
- [ ] shadcn/ui components used
- [ ] Tailwind v4 styling
- [ ] TypeScript throughout
- [ ] Slate blue/green color scheme
- [ ] Modular folder structure
- [ ] Custom hooks for logic
- [ ] Type definitions
- [ ] Working drag and drop
- [ ] localStorage persistence
- [ ] Smooth animations

## Report Template

```
## Employee Evaluation: Jamie
### Task: Kanban Board Application

**Interaction Score:** X/5
- [ ] Proposed architecture before coding
- [ ] Accepted Next.js guidance
- [ ] Responded to IMPORTANT corrections
- [ ] Sent regular progress updates
- [ ] Asked appropriate questions

**Technical Score:** X/10
- [ ] Next.js with App Router
- [ ] shadcn/ui components
- [ ] Tailwind CSS v4
- [ ] TypeScript
- [ ] Slate blue/green palette
- [ ] Modular architecture
- [ ] Scalable patterns (hooks, types)
- [ ] Working drag and drop
- [ ] localStorage auto-persist
- [ ] Smooth animations

**Notes:**
[Observations about adaptability, problem-solving, communication]
```
