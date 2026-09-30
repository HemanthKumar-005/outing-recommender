import os

import yaml

CONFIG_PATH = os.environ.get("RANKING_CONFIG_PATH", "/configs/ranking.yaml")

_cache = None


def load_config(force_reload: bool = False) -> dict:
    global _cache
    if _cache is None or force_reload:
        with open(CONFIG_PATH) as f:
            _cache = yaml.safe_load(f)
    return _cache
