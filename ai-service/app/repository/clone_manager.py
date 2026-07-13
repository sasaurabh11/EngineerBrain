import logging
import shutil
import tarfile
from pathlib import Path

import git

from app.core.config import settings
from app.repository import archive_store

logger = logging.getLogger(__name__)

ARCHIVE_SUFFIX = ".tar.gz"


def repo_path(repository_id: str) -> Path:
    return Path(settings.repo_cache_dir) / repository_id


def _temp_archive_path(repository_id: str) -> Path:
    return Path(settings.repo_cache_dir) / f"{repository_id}{ARCHIVE_SUFFIX}"


def _authenticated_url(clone_url: str, access_token: str) -> str:
    if clone_url.startswith("https://"):
        return clone_url.replace("https://", f"https://x-access-token:{access_token}@", 1)
    return clone_url


def _extract_archive(archive_path: Path, destination: Path) -> None:
    destination.mkdir(parents=True, exist_ok=True)
    with tarfile.open(archive_path, "r:gz") as tar:
        tar.extractall(destination, filter="data")


def _create_archive(source: Path, archive_path: Path) -> None:
    with tarfile.open(archive_path, "w:gz") as tar:
        tar.add(source, arcname=".")


def _try_restore_from_archive(repository_id: str) -> bool:
    temp_archive = _temp_archive_path(repository_id)
    temp_archive.parent.mkdir(parents=True, exist_ok=True)

    downloaded = archive_store.download_archive(repository_id, temp_archive)
    if not downloaded:
        return False

    _extract_archive(temp_archive, repo_path(repository_id))
    temp_archive.unlink(missing_ok=True)
    return True


def _pull(repository_id: str, authenticated_url: str, default_branch: str) -> None:
    repo = git.Repo(repo_path(repository_id))
    origin = repo.remotes.origin
    origin.set_url(authenticated_url)
    repo.git.fetch(origin.name, default_branch, depth=1)
    repo.git.reset("--hard", f"{origin.name}/{default_branch}")


def ensure_repository(repository_id: str, clone_url: str, access_token: str, default_branch: str) -> Path:
    """Clone (or restore-from-archive + pull) the repository, returning its local path."""
    path = repo_path(repository_id)
    authenticated_url = _authenticated_url(clone_url, access_token)

    if (path / ".git").exists():
        logger.info("Repository %s already cloned locally, pulling updates", repository_id)
        _pull(repository_id, authenticated_url, default_branch)
        return path

    if _try_restore_from_archive(repository_id):
        logger.info("Restored repository %s from R2 archive, pulling updates", repository_id)
        _pull(repository_id, authenticated_url, default_branch)
        return path

    logger.info("Cloning repository %s (shallow, branch=%s)", repository_id, default_branch)
    path.parent.mkdir(parents=True, exist_ok=True)
    git.Repo.clone_from(authenticated_url, path, depth=1, branch=default_branch)
    return path


def ref_scratch_path(repository_id: str, ref: str) -> Path:
    return Path(settings.repo_cache_dir) / f"{repository_id}-ref-{ref[:12]}"


def ensure_repository_at_ref(repository_id: str, clone_url: str, access_token: str, ref: str) -> Path:
    """Clones a repository at a SPECIFIC ref (branch name or commit SHA) into a
    scratch path isolated from the persisted default-branch clone
    ensure_repository manages - for one-off diff-scoped analysis (e.g. a PR's
    head commit), not the tracked default-branch state. Always re-clones
    fresh rather than pulling, since this path is only ever used a handful of
    times per PR, not kept warm like the main analysis cache."""
    path = ref_scratch_path(repository_id, ref)
    if path.exists():
        shutil.rmtree(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    authenticated_url = _authenticated_url(clone_url, access_token)
    repo = git.Repo.init(path)
    origin = repo.create_remote("origin", authenticated_url)
    origin.fetch(ref, depth=1)
    repo.git.checkout("FETCH_HEAD")
    return path


def delete_ref_scratch(repository_id: str, ref: str) -> None:
    path = ref_scratch_path(repository_id, ref)
    if path.exists():
        shutil.rmtree(path)


def persist_to_archive(repository_id: str) -> None:
    path = repo_path(repository_id)
    if not path.exists():
        return

    temp_archive = _temp_archive_path(repository_id)
    _create_archive(path, temp_archive)
    archive_store.upload_archive(repository_id, temp_archive)
    temp_archive.unlink(missing_ok=True)


def delete_repository(repository_id: str) -> None:
    path = repo_path(repository_id)
    if path.exists():
        shutil.rmtree(path)
    archive_store.delete_archive(repository_id)


def get_current_commit_sha(repository_id: str) -> str:
    repo = git.Repo(repo_path(repository_id))
    return repo.head.commit.hexsha
