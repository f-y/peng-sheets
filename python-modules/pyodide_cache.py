"""
Pyodide cache management utilities.

These functions are used by the spreadsheet-service.ts to manage
the IndexedDB-based package cache for Pyodide.
"""


def setup_cached_path(cache_path: str) -> None:
    """Add cached site-packages to sys.path for module import."""
    import sys

    sys.path.append(cache_path)


def cleanup_corrupted_cache(
    cache_path: str, module_prefix: str = "md_spreadsheet_parser"
) -> None:
    """
    Clean up corrupted cache state from sys.path and sys.modules.

    This is called when bytecode version mismatch is detected.
    The FS-level cleanup is done by TypeScript using Emscripten FS API.
    """
    import sys

    # Remove corrupted path from sys.path
    while cache_path in sys.path:
        sys.path.remove(cache_path)

    # Clear any cached module references that might be corrupted
    modules_to_remove = [
        key for key in sys.modules.keys() if key.startswith(module_prefix)
    ]
    for mod in modules_to_remove:
        del sys.modules[mod]


def cache_installed_packages(mount_dir: str, wheel_uri: str) -> None:
    """
    Cache freshly installed packages to IndexedDB mount point.

    Copies the entire site-packages directory and writes a version file.
    """
    import os
    import shutil
    import site

    site_packages = site.getsitepackages()[0]
    target = f"{mount_dir}/site-packages"

    if os.path.exists(target):
        shutil.rmtree(target)

    shutil.copytree(site_packages, target)

    with open(f"{mount_dir}/version.txt", "w") as f:
        f.write(wheel_uri)
