# Clock game asset pack

Based on the provided 1446 × 1087 reference image. Assets are kept in the source image's coordinate system for accurate alignment.

## Recommended setup

- Use `background-no-clock-parts.png` as a responsive, aspect-ratio-preserving stage image. It retains the original decorative landscape, animals, clock bezel/dial, and original sound-on button in the upper left. Clock hands and orange display have been removed using sampled clock-face colors.
- Overlay `digital-display-empty.png` at original image coordinates (588, 633); add `seven-segment.js` output on top. Alternatively use `background-with-empty-display.png` and overlay only the digit renderer.
- Overlay `minute-hand-upright.png` (BLUE) and `hour-hand-upright.png` (RED). Both use transparent 300×300 sprite canvases and have their pivot at (150, 270). Put each sprite's top-left at (574, 280) in the 1446 × 1087 stage coordinate system. Both point to 12 by default, and their CSS transform origin is `150px 270px`. Rotate the red hand 120° to display 4:00.
- Overlay `center-pivot.png` at (672, 498).
- Overlay `sound-on.png` at (54, 31). For mute state, use `sound-off-icon.svg` as a white icon overlay, or replace the speaker symbol with SVG.
- All game stage coordinates should be scaled together using one SVG viewBox (`0 0 1446 1087`) or a uniformly scaled container, not separate viewport units.
- The seven-segment demo is `seven-segment-demo.html`. Load `seven-segment.js` with a script tag before calling `createSevenSegmentClock` in the game.

## Files

- `background-no-clock-parts.png` — main scene without clock hands or the digital display
- `background-with-empty-display.png` — main scene with empty orange display frame
- `hour-hand-upright.png` — red hour arrow with normalized pivot
- `minute-hand-upright.png` — blue minute arrow with normalized pivot
- `center-pivot.png` — green center cap
- `sound-on.png` — purple speaker button, cropped from the original
- `sound-off-icon.svg` — white muted symbol to layer over purple button
- `digital-display-empty.png` — brown/orange display bezel without static digits
- `seven-segment.js` — dynamically renders red seven-segment HH:MM digits in SVG
- `seven-segment-demo.html` — standalone preview of the readout
- `asset-map.json` — dimensions and exact positions
- `reference-original.png` — original provided reference

## Notes and limits

Because the employer's source is a single flattened PNG (not layered artwork), the clean stage and blank display involve reconstruction. They should be reviewed against the source before final submission. Hand artwork is extracted from the original pixels; the hour arrow was rotated to point upward. Decorative animals and trees remain in the background rather than being individually separated. Audio belongs to separate folders in the employer's Google Drive; it is not included here.

Clock mechanics: keep one continuous `totalMinutes` value. Rotate hour hand by `totalMinutes * 0.5` degrees and minute hand by `totalMinutes * 6` degrees. This makes the hands mechanically linked in both directions.
