"""Tests for pyodide_cache module."""

import sys
from unittest.mock import MagicMock, patch


def test_setup_cached_path():
    """Test that setup_cached_path adds path to sys.path."""
    # Import here to avoid module-level side effects
    from pyodide_cache import setup_cached_path

    test_path = "/test/cache/site-packages"

    # Ensure path is not already present
    if test_path in sys.path:
        sys.path.remove(test_path)

    setup_cached_path(test_path)

    assert test_path in sys.path

    # Cleanup
    sys.path.remove(test_path)


def test_cleanup_corrupted_cache_removes_path():
    """Test that cleanup_corrupted_cache removes path from sys.path."""
    from pyodide_cache import cleanup_corrupted_cache

    test_path = "/test/corrupted/site-packages"

    # Add test path
    sys.path.append(test_path)
    sys.path.append(test_path)  # Add twice to test while loop

    cleanup_corrupted_cache(test_path)

    assert test_path not in sys.path


def test_cleanup_corrupted_cache_removes_modules():
    """Test that cleanup_corrupted_cache removes module references."""
    from pyodide_cache import cleanup_corrupted_cache

    # Add fake module references
    sys.modules["test_module"] = MagicMock()
    sys.modules["test_module.submodule"] = MagicMock()

    cleanup_corrupted_cache("/fake/path", module_prefix="test_module")

    assert "test_module" not in sys.modules
    assert "test_module.submodule" not in sys.modules


def test_cache_installed_packages(tmp_path):
    """Test that cache_installed_packages copies site-packages correctly."""
    from pyodide_cache import cache_installed_packages

    mount_dir = str(tmp_path / "mount")
    wheel_uri = "http://example.com/package-1.0.0.whl"

    # Mock site.getsitepackages to return a temp directory
    source_packages = tmp_path / "source_site_packages"
    source_packages.mkdir()
    (source_packages / "test_package").mkdir()
    (source_packages / "test_package" / "__init__.py").write_text("# test")

    with patch("site.getsitepackages", return_value=[str(source_packages)]):
        # Create mount_dir
        (tmp_path / "mount").mkdir()

        cache_installed_packages(mount_dir, wheel_uri)

    # Verify files were copied
    target = tmp_path / "mount" / "site-packages"
    assert target.exists()
    assert (target / "test_package" / "__init__.py").exists()

    # Verify version file
    version_file = tmp_path / "mount" / "version.txt"
    assert version_file.exists()
    assert version_file.read_text() == wheel_uri
