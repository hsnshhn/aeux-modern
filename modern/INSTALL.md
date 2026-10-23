# Install the 0.1.0 preview on macOS

This preview has a Sketch plugin and an unsigned After Effects CEP panel. Install both; they use separate names and IDs from original AEUX.

1. Build with `npm run build`, or download and unzip the release.
2. Run `install-macos.command` from the combined download. It copies only these two plugins into your user plugin folders and backs up any prior AEUX Modern installation. It does not change Adobe security preferences or restart apps.
3. Enable development CEP panels if they are not already enabled. For CEP 12, Adobe documents `defaults write com.adobe.CSXS.12 PlayerDebugMode 1`. This allows unsigned CEP panels for your user, not just this one. Use the runtime version that your AE installation uses. See [Adobe’s CEP cookbook](https://github.com/Adobe-CEP/CEP-Resources/blob/master/CEP_12.x/Documentation/CEP%2012%20HTML%20Extension%20Cookbook.md#debugging-unsigned-extensions). To undo this setting later, use `defaults delete com.adobe.CSXS.12 PlayerDebugMode`.
4. Restart After Effects when your work is saved, then open **Window → Extensions → AEUX Modern**. Keep the panel open to receive transfers.
5. In AE’s **Scripting & Expressions** preferences, enable **Allow Scripts to Write Files and Access Network** if it is disabled. The renderer needs it for gradient presets and transfer assets.
6. In Sketch, use **Plugins → AEUX Modern**. If Sketch was already open during installation, restart it after saving your work if the menu does not appear.

Manual locations:

- Sketch: `~/Library/Application Support/com.bohemiancoding.sketch3/Plugins/AEUX Modern.sketchplugin`
- AE: `~/Library/Application Support/Adobe/CEP/extensions/io.aeuxmodern/` (contains `CSXS/manifest.xml`)

No signing certificate or production-signed ZXP is included in this preview. The exporter, native AE renderer, and transfer server have been tested; full CEP installation and docking still need an installation smoke test on your system.

## Image workflow

Choose **Image export settings…** in Sketch. Select a preset (1, 2, 3, or 4) or type a multiplier from 0.25 to 8.

**Keep original size and position in AE** is optional:

| Resolution | Enabled: import scale | Disabled: import scale |
| --- | --- | --- |
| 1× | 100% | 100% |
| 2× | 50% | 100% |
| 3× | 33.333% | 100% |
| 4× | 25% | 100% |

The image center remains at its design position in both modes. Disabling compensation makes the image grow around that center and may extend beyond the composition. The table assumes the AE panel’s **Comp size** is 1×; that control scales the entire composition separately.

- **Send selection as images** rasterizes the selected layer(s) or frame(s), preserving transparency and baking their appearance. Select a frame for one image of the whole frame.
- **Export PNG images…** writes PNG files plus a self-contained `transfer.aeux.json` into a new folder. Import that JSON through the AE panel to retain positions and sizing options.
- **Send selection to After Effects** keeps supported content editable. Its appearance fallbacks always preserve design size, regardless of the image-mode checkbox.

## Troubleshooting

**Connection unavailable:** Open the AEUX Modern panel in AE, then run **Check AE connection** in Sketch. The panel listens on `127.0.0.1:7242`; original AEUX uses different ports. One AEUX Modern receiver can listen at a time.

**Transfer queued:** Check the AE panel for completion or errors. Sketch’s **Check last transfer** reads the final job status. Sending does not retain asynchronous native timers in Sketch.

**Images go missing later:** Keep the chosen image asset folder. AE imports those files as footage. The default is `~/Documents/AEUX Modern/Transfers/`. A portable JSON embeds the PNG data and can recreate its assets elsewhere.

**Partial import:** The AE error identifies the failure. Use AE’s Undo to remove partially created items before retrying. Each composition import is an undo group.

## Remove

Close the panel and remove the two plugin folders listed above. Backups, if needed, are in `~/Library/Application Support/AEUX Modern/Backups/`. Keep transferred image assets while projects still reference them. Uninstalling does not remove or alter your AE projects.
