"""Install Lambda dependencies locally so synth does not need a Docker daemon."""

from __future__ import annotations

import hashlib
import shutil
import subprocess
from pathlib import Path

import jsii
from aws_cdk import BundlingOptions, ILocalBundling
from aws_cdk import aws_lambda as lambda_

CDK_ROOT = Path(__file__).resolve().parents[1]
PRODUCT_ROOT = CDK_ROOT.parents[1]
REQUIREMENTS = CDK_ROOT / "assets" / "requirements-lambda.txt"
CACHE_ROOT = CDK_ROOT / ".cache" / "lambda"

SOURCE_TREES = (
    PRODUCT_ROOT / "packages" / "core" / "src" / "forgearc_ai",
    PRODUCT_ROOT / "packages" / "aws_adapter" / "src" / "forgearc_ai_aws",
    PRODUCT_ROOT / "packages" / "gcp_adapter" / "src" / "forgearc_ai_gcp",
    PRODUCT_ROOT / "apps" / "api" / "src" / "forgearc_ai_api",
)


@jsii.implements(ILocalBundling)
class LocalBundler:
    def try_bundle(
        self,
        output_dir,
        *,
        image,
        command=None,
        entrypoint=None,
        environment=None,
        local=None,
        network=None,
        output_type=None,
        platform=None,
        security_opt=None,
        user=None,
        volumes=None,
        volumes_from=None,
        working_directory=None,
        bundling_file_access=None,
    ) -> bool:
        del (
            image,
            command,
            entrypoint,
            environment,
            local,
            network,
            output_type,
            platform,
            security_opt,
            user,
            volumes,
            volumes_from,
            working_directory,
            bundling_file_access,
        )
        destination = Path(output_dir)
        destination.mkdir(parents=True, exist_ok=True)
        _install_dependencies(destination)
        _copy_sources(destination)
        shutil.copy2(CDK_ROOT / "assets" / "handler.py", destination / "handler.py")
        shutil.copy2(PRODUCT_ROOT / "forgearc-ai.yaml", destination / "forgearc-ai.yaml")
        return True


def lambda_code() -> lambda_.Code:
    return lambda_.Code.from_asset(
        str(CDK_ROOT / "assets"),
        bundling=BundlingOptions(
            image=lambda_.Runtime.PYTHON_3_12.bundling_image,
            command=["python", "-c", "raise SystemExit('local bundling is required')"],
            local=LocalBundler(),
        ),
    )


def _install_dependencies(destination: Path) -> None:
    digest = hashlib.sha256(REQUIREMENTS.read_bytes()).hexdigest()[:16]
    cached = CACHE_ROOT / digest
    marker = cached / ".installed"
    if not marker.exists():
        if cached.exists():
            shutil.rmtree(cached)
        cached.mkdir(parents=True)
        subprocess.run(
            [
                "uv",
                "pip",
                "install",
                "--python-platform",
                "x86_64-manylinux2014",
                "--python-version",
                "3.12",
                "--only-binary",
                ":all:",
                "--target",
                str(cached),
                "-r",
                str(REQUIREMENTS),
            ],
            check=True,
        )
        marker.write_text("ok\n", encoding="utf-8")
    shutil.copytree(cached, destination, dirs_exist_ok=True, ignore=shutil.ignore_patterns(".installed"))


def _copy_sources(destination: Path) -> None:
    for source in SOURCE_TREES:
        target = destination / source.name
        if target.exists():
            shutil.rmtree(target)
        shutil.copytree(
            source,
            target,
            ignore=shutil.ignore_patterns("__pycache__", "*.pyc", "*.egg-info"),
        )
