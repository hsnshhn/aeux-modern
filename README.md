# AEUX Modern

A Sketch-first fork of [google/AEUX](https://github.com/google/AEUX), built around current Sketch frames and a clearer After Effects transfer workflow. Original AEUX was created by Adam Plouff / Battle Axe and contributors. Apache 2.0.

**0.1.0 is a development preview.** Export and native import were tested on macOS with **Sketch 2026.3.1** and **After Effects 26.5.0**. The new CEP panel is unsigned; full installation/docking still needs a smoke test. Figma’s upstream source is retained for reference, but this fork’s new workflow targets Sketch.

[Download the preview](https://github.com/hsnshhn/aeux-modern/releases) · [Install and use](modern/INSTALL.md) · [Validation](modern/docs/VALIDATION.md)

## What changed

- Public Sketch DOM traversal for current frames, graphics, nested groups, paths, fills, strokes, and masks. Exact font names and attributed text use a small isolated native typography adapter.
- Editable AE text and vectors, native modern track mattes, and groups as precomps. Symbol overrides are read through expanded layers without detaching the original Sketch instance.
- Two explicit transfer modes: editable layers, or selection as PNG images.
- Image resolution presets and custom multipliers from **0.25× to 8×**. An optional **Keep original size and position in AE** checkbox compensates import scale: **2× → 50%, 4× → 25%**. Turn it off for **100%** import scale. Resolution and composition size are separate controls.
- **Export PNG images…** writes transparent PNGs and a portable transfer JSON with embedded assets. The portable file works without a live Sketch connection.
- A new AE panel with destination, frame rate, duration, composition size, asset location, and clear transfer status. It installs separately from original AEUX.
- A loopback-only receiver with queued jobs, duplicate-request handling, payload validation, bounded transfers, and structured import failures. Sketch reports acceptance; completion is shown in AE or through **Check last transfer**.
- Dependency-free modern builds and regression tests. No need to install the old Vue/Webpack packages to build this fork.

## Quick start

Download the combined macOS ZIP from Releases, then follow [INSTALL.md](modern/INSTALL.md). This is an unsigned CEP development build, not a signed ZXP.

In Sketch, open **Plugins → AEUX Modern → Image export settings…** to choose image resolution and the optional scale compensation. Then use **Send selection to After Effects**, **Send selection as images**, or **Export PNG images…**.

In AE, keep **Window → Extensions → AEUX Modern** open. Use **New composition** for separate frames, or **Current comp** for a single frame’s selection. The panel’s **Comp size** changes the layout size; it does not set PNG resolution.

## Build and check

Requires Node 22 or newer. There are no npm dependencies.

```sh
npm run check
```

Builds both plugins and ZIP downloads into `dist/`. `dist/install-macos.command` is an explicit installer; building does not install plugins, restart apps, or change security preferences.

On macOS with Sketch and AE open, the opt-in native test suite creates disposable fixtures, renders comparisons, verifies actual AE layer types/scales/positions, and removes its new AE items:

```sh
npm run test:native
```

It never saves or closes the existing AE project. Native tests may mark that project modified while adding/removing test items. Set `AEUX_AE_APP` or `AEUX_SKETCHTOOL` for different app names/locations. Fixtures and reports are written to `work/native-check/`.

## Fidelity and limits

Supported native paths include editable text (including mixed font/color runs), standard fills and strokes, 2–8-stop linear/radial gradients, Bezier paths, uniform rounded rectangles, frame clipping, and symbol contents. Transfer is one-way; reimport creates layers and does not preserve animation by matching design IDs.

Blur/glass, image fills, unsupported gradients, explicit `*` layers, and unsupported layer types fall back to PNG with a diagnostic. Inside/outside stroke alignment, P3 color management, variable font axes, font substitution, and complex masking need a visual check. Non-shape outline masks use rendered alpha with a warning. Native fallback choices favor a usable result over silently dropping unsupported appearance. Use image mode when exact appearance matters more than editability.

The live receiver supports one AEUX Modern panel/AE instance at a time. Image assets remain in your selected folder because AE footage references them. The preview has no telemetry or cloud transfer.

## Source layout

- `modern/sketch/`: native Sketch commands, settings, and image export adapter.
- `modern/shared/serializer.js`: Sketch DOM to transfer schema.
- `modern/ae/`: new CEP panel, local receiver, host entry, and explicit renderer patches.
- `modern/tests/`: unit/transport tests and opt-in real-app fixtures.
- `Sketch/`, `Ae/`, `Figma/`, `Documentation/`: original upstream code/reference assets.

The renderer is generated from upstream’s compiled ExtendScript with checked patch anchors; a source change that breaks those anchors fails the build. See [NOTICE](modern/NOTICE.md), [the upstream README](modern/UPSTREAM_README.md), and [LICENSE](LICENSE.md).
