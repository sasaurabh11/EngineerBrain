import logging
from pathlib import Path

import boto3
from botocore.exceptions import ClientError

from app.core.config import settings

logger = logging.getLogger(__name__)


def is_configured() -> bool:
    return bool(settings.r2_account_id and settings.r2_access_key_id and settings.r2_secret_access_key)


def _get_client():
    return boto3.client(
        "s3",
        endpoint_url=f"https://{settings.r2_account_id}.r2.cloudflarestorage.com",
        aws_access_key_id=settings.r2_access_key_id,
        aws_secret_access_key=settings.r2_secret_access_key,
        region_name="auto",
    )


def _object_key(repository_id: str) -> str:
    return f"{repository_id}/repo.tar.gz"


def upload_archive(repository_id: str, archive_path: Path) -> None:
    if not is_configured():
        logger.info("R2 not configured, skipping archive upload for %s", repository_id)
        return

    client = _get_client()
    client.upload_file(str(archive_path), settings.r2_bucket_name, _object_key(repository_id))


def download_archive(repository_id: str, destination_path: Path) -> bool:
    if not is_configured():
        return False

    client = _get_client()
    try:
        client.download_file(settings.r2_bucket_name, _object_key(repository_id), str(destination_path))
        return True
    except ClientError as exc:
        error_code = exc.response.get("Error", {}).get("Code")
        if error_code in ("404", "NoSuchKey"):
            return False
        raise


def delete_archive(repository_id: str) -> None:
    if not is_configured():
        return

    client = _get_client()
    client.delete_object(Bucket=settings.r2_bucket_name, Key=_object_key(repository_id))
