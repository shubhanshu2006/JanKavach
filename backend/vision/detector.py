"""
YOLOv8 inference wrapper.
Runs real person detection on video frames — no mocking.
"""
import cv2
import numpy as np
from pathlib import Path
from typing import Iterator
from ultralytics import YOLO

from vision.zone_map import point_to_zone
from config.store import config_store

_model: YOLO | None = None

def _get_model() -> YOLO:
    global _model
    if _model is None:
        _model = YOLO("yolov8n.pt")
    return _model


def detect_frame(frame: np.ndarray) -> dict[str, int]:
    """
    Run YOLOv8 on a single frame.
    Returns {zone_id: person_count} for all zones.
    """
    model = _get_model()
    results = model.track(frame, persist=True, classes=[0], verbose=False)

    zone_counts: dict[str, int] = {z.id: 0 for z in config_store.get().zones}

    if results and results[0].boxes is not None:
        boxes = results[0].boxes.xywh.cpu().numpy()
        for box in boxes:
            cx, cy = float(box[0]), float(box[1])
            zone = point_to_zone(cx, cy)
            if zone and zone in zone_counts:
                zone_counts[zone] += 1

    return zone_counts


def video_frame_iter(video_path: str, fps_target: int = 5) -> Iterator[np.ndarray]:
    """Yield frames from a video file at fps_target rate."""
    cap = cv2.VideoCapture(video_path)
    if not cap.isOpened():
        raise FileNotFoundError(f"Cannot open video: {video_path}")

    source_fps = cap.get(cv2.CAP_PROP_FPS) or 25.0
    step = max(1, int(source_fps / fps_target))
    frame_idx = 0

    while True:
        ret, frame = cap.read()
        if not ret:
            cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
            continue
        if frame_idx % step == 0:
            frame = cv2.resize(frame, (640, 480))
            yield frame
        frame_idx += 1

    cap.release()
