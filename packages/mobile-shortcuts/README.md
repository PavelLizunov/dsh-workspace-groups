# Local mobile shortcuts

Companion source for the deployed `dsh-web-mobile` 2.3.1 local adaptation; not a new upload backend or replacement mobile shell.

- Shortcuts are visible only on narrow touch-first screens (<=767px, coarse primary pointer, no hover), never in a narrow mouse-driven desktop window.
- A resident Photo button calls the host composer's native file input, requesting `image/*` and `capture=environment` synchronously in the tap. Photos remain in the draft.
- A thumb-zone Panel button opens the existing right-panel control. A shell-owned, portaled Back to chat button stays reachable at the bottom of the fullscreen panel and invokes its existing collapse control.
- Shortcut presses prevent editor focus; camera input clicks do not bubble into the composer focus handler. An already focused composer is blurred before capture. No delayed/asynchronous picker invocation is introduced.
- Session taps in grouped rows use the existing mobile navigation observer: the drawer closes as soon as the selected session changes, with action buttons excluded. Group rows expose stable session IDs so equal titles still navigate correctly.
- The existing mobile bundle and local patches are retained, with rc.2 icon aliases corrected.
- Phone drawer width grows to 92vw (maximum 360px), including its inner sidebar surface. Desktop is unchanged.

`node scripts/build-mobile-shortcuts.mjs <output-directory>` generates a full mobile package from the installed baseline, using existing esbuild. The baseline must not already contain this extension; a saved baseline is required after deployment (`DSH_MOBILE_BASELINE=/absolute/path/to/baseline.js`). The tool fails closed on an unexpected loader/apply contract.

The current developer paths in build/GUI probe scripts describe this local installation, not a portable npm installation. Installable packages retain their existing client declaration and profile ownership. Only verified client artifacts are deployed; no host restart.

Native camera behavior still needs a physical iPhone check. Chromium confirmed the button invokes the existing chooser with camera attributes, then restores the general picker configuration. Safari determines whether it launches the camera immediately or shows a system choice. Camera cancellation and choosing a file never auto-submit a message.
