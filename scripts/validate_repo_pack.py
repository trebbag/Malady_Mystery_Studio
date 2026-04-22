#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import subprocess
import sys


ROOT = Path(__file__).resolve().parents[1]
NODE_VALIDATOR = ROOT / "scripts" / "validate_repo_pack.mjs"

result = subprocess.run(["node", str(NODE_VALIDATOR)], cwd=ROOT, check=False)
sys.exit(result.returncode)
