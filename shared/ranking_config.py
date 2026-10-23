from pathlib import Path
import os
import yaml

_LOCAL_FALLBACK = Path(__file__).resolve().parents[1] / "configs" / "ranking.yaml"
CONFIG_PATH = os.environ.get(
    "RANKING_CONFIG_PATH",
    str(_LOCAL_FALLBACK) if not Path("/configs/ranking.yaml").is_file() and _LOCAL_FALLBACK.is_file() else "/configs/ranking.yaml"
)

_cache = None


def load_config(force_reload: bool = False) -> dict:
    global _cache
    if _cache is None or force_reload:
        with open(CONFIG_PATH) as f:
            _cache = yaml.safe_load(f)
    return _cache
