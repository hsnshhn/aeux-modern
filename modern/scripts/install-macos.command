#!/bin/bash
set -euo pipefail
if [[ "$(uname -s)" != "Darwin" ]]; then
  echo "This installer is for macOS."
  exit 1
fi
aeux_install_dir="$(cd "$(dirname "$0")" && pwd)"
aeux_backup_dir="$HOME/Library/Application Support/AEUX Modern/Backups/$(date +%Y%m%d-%H%M%S)"
aeux_sketch_target="$HOME/Library/Application Support/com.bohemiancoding.sketch3/Plugins/AEUX Modern.sketchplugin"
aeux_ae_target="$HOME/Library/Application Support/Adobe/CEP/extensions/io.aeuxmodern"
if [[ ! -d "$aeux_install_dir/AEUX Modern.sketchplugin" || ! -f "$aeux_install_dir/AEUX Modern/CSXS/manifest.xml" ]]; then
  echo "Keep this installer beside AEUX Modern.sketchplugin and the AEUX Modern panel folder."
  exit 1
fi
for aeux_target in "$aeux_sketch_target" "$aeux_ae_target"; do
  if [[ -e "$aeux_target" ]]; then
    mkdir -p "$aeux_backup_dir"
    mv "$aeux_target" "$aeux_backup_dir/$(basename "$aeux_target")"
  fi
  mkdir -p "$(dirname "$aeux_target")"
done
ditto "$aeux_install_dir/AEUX Modern.sketchplugin" "$aeux_sketch_target"
ditto "$aeux_install_dir/AEUX Modern" "$aeux_ae_target"
echo "Installed AEUX Modern for Sketch and After Effects."
echo "This is an unsigned development preview. Follow INSTALL.md for CEP setup."
echo "Save your work before restarting apps. No app has been restarted."
