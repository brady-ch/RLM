---
title: Remote Plugin Fetch to Local Folder
planted_date: 2026-05-14
trigger_condition: "After local folder plugin install, enable, disable, list, and doctor flows are stable"
status: active
---

## Intent

Add remote plugin support without introducing a marketplace or remote execution model.

Remote fetch should download a plugin archive or repository into a specific local plugin folder, then run the same manifest validation, permission review, approval, and enablement flow used for local folder plugins.

## Notes

- Treat fetched plugins as local plugins after download or unpack.
- Keep remote support optional and secondary to local folder installation.
- Do not execute code during fetch or validation.
- Preserve the same installed layout under the user RLM data directory.
- Prefer explicit user-selected destination or deterministic `~/.rlm/plugins/<plugin-id>` placement.

