"""
Maps pixel bounding boxes from YOLOv8 detections to station zones.
Zone pixel boundaries are calibrated for the demo video resolution (640x480).
"""
from dataclasses import dataclass
from typing import Optional

@dataclass
class ZoneBounds:
    x1: int
    y1: int
    x2: int
    y2: int
    zone_id: str

# Pixel boundaries mapped to a 640x480 video frame.
# Adjust these when using a different video by running zone_calibration.py
VIDEO_WIDTH = 640
VIDEO_HEIGHT = 480

ZONE_BOUNDS: list[ZoneBounds] = [
    ZoneBounds(0,   0,   640, 80,  "CONC"),
    ZoneBounds(0,   80,  213, 480, "P1"),
    ZoneBounds(213, 80,  426, 240, "FOB1"),
    ZoneBounds(213, 240, 426, 480, "P2"),
    ZoneBounds(426, 80,  640, 240, "FOB2"),
    ZoneBounds(426, 240, 640, 480, "P3"),
]

# Extended zone map used in scenario mode (all 12 zones)
ZONE_BOUNDS_FULL: list[ZoneBounds] = [
    ZoneBounds(0,   0,   640, 60,  "CONC"),
    ZoneBounds(30,  5,   120, 55,  "GATE_A"),
    ZoneBounds(280, 5,   370, 55,  "GATE_B"),
    ZoneBounds(530, 5,   620, 55,  "GATE_C"),
    ZoneBounds(0,   60,  320, 100, "FOB1"),
    ZoneBounds(320, 60,  640, 100, "FOB2"),
    ZoneBounds(0,   100, 640, 165, "P1"),
    ZoneBounds(0,   165, 640, 230, "P2"),
    ZoneBounds(0,   230, 640, 295, "P3"),
    ZoneBounds(0,   295, 640, 360, "P4"),
    ZoneBounds(0,   360, 640, 425, "P5"),
    ZoneBounds(0,   425, 640, 480, "P6"),
]


def point_to_zone(cx: float, cy: float) -> Optional[str]:
    """Return zone_id for a person centroid (cx, cy). Last matching zone wins (most specific)."""
    result = None
    for zb in ZONE_BOUNDS_FULL:
        if zb.x1 <= cx < zb.x2 and zb.y1 <= cy < zb.y2:
            result = zb.zone_id
    return result
