---
"diffhub": patch
---

Fix sidebar toggle button so a click actually collapses and expands the
sidebar. `SidebarTrigger` was being wrapped by a Base UI `TooltipTrigger`
render prop, which merged its own click handler into the rendered
component's props. The custom trigger hard-coded `onClick={toggleSidebar}`
before spreading `{...props}`, so the merged handler overwrote the toggle.
Destructure `onClick` out of `props`, compose it with `toggleSidebar` in a
`useCallback`, and spread props before the final `onClick`. Also drop
`aria-expanded:bg-muted` from the ghost button variant so the trigger
doesn't sit visually stuck-on while the sidebar is open.
