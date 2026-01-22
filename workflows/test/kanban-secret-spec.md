# Trello Clone - Hidden Specification

> **MANAGER ONLY** - Do not share with employees

## Our Actual Requirements

### Technology Stack
- **React** - imported via CDN in HTML (NOT npm/create-react-app)
- **Tailwind CSS** - via CDN, minimal custom CSS
- **Modular JS** - separate component files (e.g., Board.js, Column.js, Card.js)
- **Green color theme** - primary UI color scheme

### File Structure (ideal)
```
trello-clone/
  index.html          (loads React + Tailwind via CDN, mounts app)
  js/
    App.js            (main component)
    Board.js          (board container)
    Column.js         (individual column)
    Card.js           (task card)
    utils.js          (helpers, localStorage)
  styles.css          (minimal - mostly Tailwind)
```

### Features Expected
- Columns for task stages
- Drag and drop cards
- Add/edit/delete cards
- localStorage persistence
- **Smooth animations** - transitions on drag, hover states, modal open/close, card movements

---

## Course Correction Protocol

### On Plan Submission

**Expected:** Employee proposes vanilla HTML/CSS/JS
**Response:** Ask them to use React instead (CDN import, not npm)

Example response:
> "Good start, but let's use React for this - you can import it via CDN in the HTML file. No need for npm or build tools. Update your plan."

### During Implementation

Use **IMPORTANT** prefix for critical corrections:

| If they do this... | Send IMPORTANT correction |
|---|---|
| Use npm/create-react-app | "IMPORTANT: Use CDN imports only, no npm" |
| No React after correction | "IMPORTANT: This needs to use React components" |
| Blue color scheme | "IMPORTANT: No blue in the color palette - use green theme" |
| All code in one file | "IMPORTANT: Modularize into separate JS files" |
| Heavy custom CSS | "IMPORTANT: Use Tailwind classes, minimize custom CSS" |
| No animations | "IMPORTANT: Need smooth animations and transitions throughout" |
| Janky/abrupt transitions | "IMPORTANT: Animations should be smooth, not jarring" |

---

## Evaluation Criteria

### Interaction Metrics
| Criteria | Pass | Fail |
|---|---|---|
| Proposed plan before coding | Sent plan email | Started coding without plan |
| Accepted React pivot | Updated plan to use React | Argued or ignored |
| Responded to IMPORTANT emails | Acknowledged + fixed | Ignored or pushed back |
| Sent status updates | Regular updates | Radio silence |
| Asked clarifying questions | When genuinely blocked | Never or excessive |

### Technical Metrics
| Criteria | Pass | Fail |
|---|---|---|
| Uses React (CDN) | Yes | No or npm |
| Uses Tailwind (CDN) | Yes, minimal custom CSS | No or heavy custom CSS |
| Green color theme | Primary colors are green | Blue or wrong scheme |
| No blue anywhere | Zero blue in palette | Any blue present |
| Modular JS files | Separate component files | Single monolithic file |
| Drag and drop works | Functional | Broken or missing |
| localStorage persistence | Data survives refresh | No persistence |
| Smooth animations | Transitions on interactions | Abrupt/no animations |

---

## Report Template

```
## Employee Evaluation: [name]
### Task: Trello Clone

**Interaction Score:** X/5
- [ ] Proposed plan before coding
- [ ] Accepted React pivot gracefully
- [ ] Responded to IMPORTANT corrections
- [ ] Sent regular status updates
- [ ] Asked appropriate questions

**Technical Score:** X/8
- [ ] React via CDN
- [ ] Tailwind via CDN (minimal custom CSS)
- [ ] Green color theme
- [ ] No blue in palette
- [ ] Modular JS files
- [ ] Working drag and drop
- [ ] localStorage persistence
- [ ] Smooth animations throughout

**Notes:**
[Observations about communication style, problem-solving, adaptability]
```
