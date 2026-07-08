"""Shared environment configuration via python-decouple.

AutoConfig reads ``apps/api/.env`` from BASE_DIR. Process environment values
override file values. Import ``config`` from here in settings and answer providers.
"""

from pathlib import Path

from decouple import AutoConfig, Csv

BASE_DIR = Path(__file__).resolve().parent.parent
config = AutoConfig(search_path=BASE_DIR)

__all__ = ["BASE_DIR", "Csv", "config"]
