# Preview validation — 23 October 2026

Native fixture runs used Sketch 2026.3.1 (API 2.0.0) and After Effects 26.5.0 on macOS. These fixtures test export and the native AE renderer. They do not establish compatibility with every Sketch document or verify a complete installed CEP-panel workflow.

## Verified

| Fixture | Checks |
| --- | --- |
| Basic | Editable text, ellipse/rectangle shapes, nested groups, frame clipping, outline masks, transparency, rotated PNG fallback |
| Advanced | Native three-stop gradient, Bezier path, rounded rectangle with shadow, rotated group, point text, mixed font runs, symbol text override and source background |
| Images 2× | Actual AE scale 50%, center (320, 240), original apparent size |
| Images 4× | Actual AE scale 25%, center (320, 240), original apparent size |
| Images without compensation | Actual AE scale 100%, same center (320, 240) |

The native image settings dialog was opened through the plugin manifest. Its resolution field and optional checkbox were inspected; the checkbox was toggled and the dialog cancelled without changing saved preferences.

The real Sketch **Send selection as images** command was exercised against a temporary local receiver. The receiver validated the generated PNG transfer and completed the job. The corrected command exits synchronously without retaining native timers.

The automated suite also covers partial selection hierarchy, multiple frames, symbol expansion without detaching sources, hidden/empty selections, image writing order, payload rejection, request deduplication, and failed AE jobs.

## Render comparison

Each pair is 640 × 480 pixels. Mean absolute RGB error is measured per channel on the 0–255 scale, without image registration or rescaling. It includes differences in antialiasing, shadow rendering, and gradient interpolation; it is not a universal similarity score.

| Fixture | Mean absolute RGB error |
| --- | ---: |
| Basic editable | 0.0997 |
| Advanced editable | 0.3490 |
| Images 2×, compensated | 0.0129 |
| Images 4×, compensated | 0.0464 |

[Basic Sketch reference](basic-sketch.png) · [Basic AE render](basic-ae.png) · [Advanced Sketch reference](advanced-sketch.png) · [Advanced AE render](advanced-ae.png)

## Fixed during testing

The native tests caught default frame fills affecting transparent PNG crops, an incorrect baseline enumeration, missing symbol-source backgrounds, and differences in mask appearance. The implementation was corrected and the fixtures rerun.

An experimental raw `NSTimer` callback used for Sketch completion polling caused a Sketch crash during a direct-send test. That polling implementation was removed. Completion feedback now belongs to the AE panel, with a synchronous **Check last transfer** command in Sketch. The corrected direct-send command was rerun successfully, and the three previously open Sketch documents were reopened and their IDs verified. The native export/import fixtures passed before this send-only change.

## Still to verify

Full installation and docking of the unsigned CEP panel; Windows; fonts not present on both systems; complex real-world boolean/mask combinations; nonuniform/smooth corners; and unusual typography or color-management cases. The release remains a development preview.
