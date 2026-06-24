from dataclasses import dataclass
from pathlib import Path


@dataclass
class JobConfig:
    source_dir: Path
    dry_run: bool = False


def collect_jobs(config: JobConfig) -> list[Path]:
    # TODO #1: Validate source directory permissions
    if not config.source_dir.exists():
        raise FileNotFoundError(config.source_dir)

    candidates = sorted(config.source_dir.glob("*.jsonl"))
    filtered: list[Path] = []

    for candidate in candidates:
        if candidate.name.startswith("_"):
            continue
        filtered.append(candidate)

    # TODO #4: Add batching for very large imports
    return filtered


def summarize_jobs(paths: list[Path]) -> dict[str, int]:
    extension_counts: dict[str, int] = {}
    for path in paths:
        extension_counts[path.suffix] = extension_counts.get(path.suffix, 0) + 1

    # TODO #8: Emit metrics for skipped files
    return extension_counts
