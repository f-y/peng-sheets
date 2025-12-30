import base64
import hashlib
import shutil
import subprocess
import sys
import tempfile
import zipfile
from pathlib import Path


def build_pyc_wheel():
    # Source directory (python-modules/)
    project_root = Path.cwd() / "python-modules"
    if not project_root.exists():
        # Fallback if running from proper root
        project_root = Path.cwd()
        if not (project_root / "src" / "md_spreadsheet_editor").exists():
            # Try assuming we are inside python-modules
            project_root = Path.cwd()
            if not (project_root / "src" / "md_spreadsheet_editor").exists():
                # Back to repo root
                project_root = Path.cwd() / "python-modules"

    src_dir = project_root / "src"
    package_name = "md_spreadsheet_editor"

    # Ensure we are in the right place
    if not (src_dir / package_name).exists():
        print(
            f"Error: Could not find src/{package_name}. Please run from project root."
        )
        sys.exit(1)

    print(f"Building pyc wheel from {src_dir}")

    # Create a temporary directory for the build
    with tempfile.TemporaryDirectory() as temp_dir:
        build_root = Path(temp_dir)
        lib_build_dir = build_root / "src"

        # Copy source to temp
        shutil.copytree(src_dir, lib_build_dir)

        # Compile to .pyc
        # -b: Write byte-code files to their legacy locations and names (overwrite .py or side-by-side)
        print("Compiling to bytecode...")
        subprocess.check_call(
            [sys.executable, "-m", "compileall", "-b", "-f", str(lib_build_dir)]
        )

        # Remove all .py files, keep only .pyc
        print("Removing .py files...")
        for py_file in lib_build_dir.rglob("*.py"):
            py_file.unlink()

        # Verify we have .pyc files
        pyc_count = len(list(lib_build_dir.rglob("*.pyc")))
        print(f"Found {pyc_count} .pyc files.")
        if pyc_count == 0:
            print("Error: No .pyc files generated.")
            sys.exit(1)

        print("Building standard wheel to get metadata...")
        # We need to run build in the python-modules dir
        subprocess.check_call(
            [
                "uv",
                "build",
                "--wheel",
                "--out-dir",
                str(build_root / "dist"),
            ],
            cwd=project_root,
        )

        # Find the generated wheel
        wheels = list((build_root / "dist").glob("*.whl"))
        if not wheels:
            print("Error: Standard build failed to produce a wheel.")
            sys.exit(1)

        std_wheel = wheels[0]
        wheel_name = std_wheel.name
        print(f"Base wheel: {wheel_name}")

        # Extract the standard wheel
        unpack_dir = build_root / "unpacked"
        with zipfile.ZipFile(std_wheel, "r") as zf:
            zf.extractall(unpack_dir)

        # Replace source with compiled bytecode in the unpacked dir
        # 1. Remove .py files from unpacked package dir
        pkg_dir = unpack_dir / package_name
        if pkg_dir.exists():
            shutil.rmtree(pkg_dir)

        # 2. Copy our compiled .pyc tree to where the package was
        shutil.copytree(lib_build_dir / package_name, pkg_dir)

        # 3. Update RECORD manually
        dist_info_dir = list(unpack_dir.glob("*.dist-info"))[0]

        print(f"Re-packing into {wheel_name}...")

        # Output to resources so it can be served/bundled
        repo_root = project_root.parent
        output_dir = repo_root / "resources"
        output_dir.mkdir(parents=True, exist_ok=True)
        output_wheel_path = output_dir / wheel_name

        # Also cleanup old wheels in public to avoid accumulation
        for old_whl in output_dir.glob(f"{package_name}-*.whl"):
            old_whl.unlink()

        with zipfile.ZipFile(
            output_wheel_path, "w", compression=zipfile.ZIP_DEFLATED
        ) as zf:
            valid_files = []
            for filepath in unpack_dir.rglob("*"):
                if filepath.is_dir():
                    continue
                if filepath.name == "RECORD":
                    continue

                arcname = filepath.relative_to(unpack_dir)

                # Check contents
                data = filepath.read_bytes()
                sha256 = hashlib.sha256(data).digest()
                hash_str = "sha256=" + base64.urlsafe_b64encode(sha256).decode(
                    "utf-8"
                ).rstrip("=")
                size = len(data)

                zf.write(filepath, arcname)
                valid_files.append((str(arcname), hash_str, size))

            # Now create RECORD content
            record_lines = []
            for fname, fhash, fsize in valid_files:
                record_lines.append(f"{fname},{fhash},{fsize}")

            record_lines.append(f"{dist_info_dir.name}/RECORD,,")
            record_content = "\n".join(record_lines) + "\n"

            # Write RECORD
            zf.writestr(f"{dist_info_dir.name}/RECORD", record_content)

    print(f"Successfully created optimized wheel at {output_wheel_path}")


if __name__ == "__main__":
    build_pyc_wheel()
