# UI Redesign — macOS/Kimi/Edge Hybrid Design System

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Complete UI redesign of the data analysis workbench with a light, airy, content-focused modern style inspired by macOS, Kimi, and Edge.

**Architecture:** Create a CSS custom-property design system (`src/styles/design-tokens.css`), then rewrite layout components (glass-morphism AppLayout, collapsible 240px Sidebar, 56px TopBar) and all 7 pages with the new design language. All inline Ant Design styles replaced with design-token-driven patterns.

**Tech Stack:** React 18 + TypeScript, Ant Design 5, CSS Custom Properties, Vite

## Global Constraints
- Font: `-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- Background: `linear-gradient(135deg, #F7F9FC 0%, #EFF2F7 100%)`
- Card background: `rgba(255, 255, 255, 0.65)` with `backdrop-filter: blur(20px)`
- Card border: `1px solid rgba(255, 255, 255, 0.8)`
- Border radius: 12px (components), 16px (cards/containers)
- Shadow: `0 4px 12px rgba(0,0,0,0.03)`
- Text color: `#333` (primary), `#888` (secondary)
- Padding: min 24px
- Transition: `all 0.2s ease-in-out`
- TopBar: 56px, Sidebar: 240px collapsible, Content: max-width 1000px centered

## File Structure
- Create: `src/styles/design-tokens.css` — CSS custom properties for the design system
- Modify: `src/main.tsx` — import design tokens
- Modify: `src/App.tsx` — update ConfigProvider theme tokens
- Modify: `src/components/layout/AppLayout.tsx` — new glass layout structure
- Modify: `src/components/layout/Sidebar.tsx` — 240px collapsible, icon+text, hover bg
- Modify: `src/components/layout/TopBar.tsx` — 56px glass morphism
- Modify: `src/components/layout/Footer.tsx` — minimal translucent footer
- Modify: `src/components/common/EmptyState.tsx` — new card style
- Modify: `src/components/data/DataTable.tsx` — glass card wrapper
- Modify: `src/components/data/ColumnBadge.tsx` — lighter tag style
- Modify: `src/pages/HomePage.tsx` — new card-based layout
- Modify: `src/pages/ImportPage.tsx` — glass steps + centered upload
- Modify: `src/pages/CleaningPage.tsx` — glass tabs
- Modify: `src/pages/AnalysisPage.tsx` — glass panels
- Modify: `src/pages/ChartsPage.tsx` — glass gallery
- Modify: `src/pages/HistoryPage.tsx` — glass timeline
- Modify: `src/pages/SettingsPage.tsx` — glass settings cards
- Modify: `src/App.test.tsx` — update test selectors

---
