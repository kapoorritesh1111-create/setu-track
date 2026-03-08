# Phase 2C Sidebar + Analytics Nav Update

## What changed
- Added Analytics to the main AppShell navigation for admin and manager roles.
- Simplified the sidebar brand block to remove oversized duplicate logo treatment.
- Removed the org badge under the logo to reduce visual clutter.
- Aligned mobile drawer branding to the same compact SETU TRACK structure.
- Replaced CSS values that triggered autoprefixer mixed-support warnings (`end`/`start`) with `flex-end`/`flex-start`.

## Why
The deployed dashboard looked strong, but the sidebar still felt visually heavy and the Analytics workspace was not discoverable enough from global navigation. This pass makes the shell cleaner and better connected to the new command-center flow.
