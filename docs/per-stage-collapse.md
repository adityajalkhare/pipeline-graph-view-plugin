# Per-Stage Collapse

Pipeline stages that contain children (nested stages, parallel branches) can be
individually collapsed and expanded.

## Collapsing a single stage

Any stage with children shows a badge next to its label: the child count in
parentheses and a chevron icon. Clicking the badge toggles that single stage
between expanded (children visible) and collapsed (children hidden, count shown).
The chevron rotates to indicate state.

When a stage is collapsed, its status icon reflects the worst result among its
hidden children, so failures still bubble up visually.

## Collapse All / Expand All

The zoom controls bar (next to zoom in/out/reset) includes a toggle button for
bulk collapse. When all stages are expanded it reads "Collapse all stages"; when
any are collapsed it reads "Expand all stages". This button only appears when
the pipeline has at least one collapsible stage.

## State persistence

Your collapsed/expanded choices are saved in the browser's localStorage and
survive page refreshes. Each view (build page, graph overview) tracks its own
state independently.

## Admin default

Admins can set the initial collapse state for all users under
Manage Jenkins > Appearance > Pipeline Graph View by checking
"Collapse nested stages by default". This also works through JCasC.

When enabled, all parent stages start collapsed for users who haven't interacted
with the collapse controls yet. Once a user expands or collapses any stage
manually, their choice takes over and the admin default no longer applies.

If the setting is off (the default), all stages start expanded.
