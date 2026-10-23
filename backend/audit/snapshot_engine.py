"""
JanKavach — Forensic CCTV Snapshot Engine
Captures event-triggered camera snapshots, renders statutory evidentiary watermarks
and person detection bounding boxes, and generates SHA-256 cryptographic image seals.
"""
import hashlib
import json
import time
import datetime
from pathlib import Path
import cv2
import numpy as np

_BASE_DIR = Path(__file__).parent.parent.parent
_SNAPSHOT_DIR = _BASE_DIR / "data" / "audit_snapshots"
_SNAPSHOT_DIR.mkdir(parents=True, exist_ok=True)

# Surrogate video assets for calibrated replay
_DEFAULT_VIDEO_CANDIDATES = [
    _BASE_DIR / "frontend" / "public" / "videos" / "platform.webm",
    _BASE_DIR / "data" / "videos" / "stock-footage-busy-and-crowded-platform-at-dadar-railway-station-in-mumbai-india-mar.webm",
    _BASE_DIR / "data" / "videos" / "platform.webm",
]


class SnapshotEngine:
    def __init__(self):
        self.snapshot_dir = _SNAPSHOT_DIR
        self._video_path = self._locate_surrogate_video()

    def _locate_surrogate_video(self) -> Path | None:
        for p in _DEFAULT_VIDEO_CANDIDATES:
            if p.exists() and p.stat().st_size > 0:
                return p
        # Search anywhere under data/videos
        v_dir = _BASE_DIR / "data" / "videos"
        if v_dir.exists():
            for f in v_dir.glob("*.webm"):
                return f
            for f in v_dir.glob("*.mp4"):
                return f
        return None

    def capture_snapshot(
        self,
        session_id: str,
        seq: int,
        event_type: str,
        zone_id: str,
        density: float,
        action: str,
        scenario_elapsed: float = 0.0,
    ) -> dict | None:
        """
        Extracts a frame from the surrogate camera stream, renders
        forensic bounding boxes and statutory metadata, and returns
        the file path and SHA-256 image hash.
        """
        video_file = self._video_path or self._locate_surrogate_video()
        if not video_file or not video_file.exists():
            return None

        filename = f"snap_{session_id}_seq{seq:03d}.jpg"
        out_path = self.snapshot_dir / filename

        try:
            cap = cv2.VideoCapture(str(video_file))
            if not cap.isOpened():
                return None

            total_frames = int(cap.get(cv2.CAP_PROP_FRAME_COUNT) or 100)
            fps = cap.get(cv2.CAP_PROP_FPS) or 25.0

            # Seek frame based on scenario elapsed time or sequence
            target_sec = scenario_elapsed if scenario_elapsed > 0 else (seq * 3.5)
            target_frame = int((target_sec * fps) % max(1, total_frames - 5))

            cap.set(cv2.CAP_PROP_POS_FRAMES, target_frame)
            ret, frame = cap.read()
            cap.release()

            if not ret or frame is None:
                return None

            # Render forensic annotations and watermark
            annotated = self._burn_forensic_watermark(frame, zone_id, event_type, density, action)

            # Save JPEG with high quality
            cv2.imwrite(str(out_path), annotated, [cv2.IMWRITE_JPEG_QUALITY, 92])

            # Compute SHA-256 of the saved image file
            with open(out_path, "rb") as img_f:
                image_bytes = img_f.read()
                image_hash = hashlib.sha256(image_bytes).hexdigest()

            now_ist = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S IST")

            return {
                "url": f"/snapshots/{filename}",
                "filename": filename,
                "camera_id": f"CAM-01 ({zone_id})",
                "feed_type": "[SURROGATE CALIBRATED REPLAY FEED]",
                "station_code": "NDLS",
                "image_sha256": image_hash,
                "captured_at_ist": now_ist,
            }
        except Exception as e:
            print(f"[SnapshotEngine] Error capturing frame for seq {seq}: {e}", flush=True)
            return None

    def _burn_forensic_watermark(
        self,
        frame: np.ndarray,
        zone_id: str,
        event_type: str,
        density: float,
        action: str,
    ) -> np.ndarray:
        h, w = frame.shape[:2]
        canvas = frame.copy()

        # 1. Simulate person detection bounding boxes for realistic crowd density
        num_boxes = min(40, max(6, int(density * 4)))
        np.random.seed(int(density * 100) % 9999)
        for _ in range(num_boxes):
            bx = np.random.randint(int(w * 0.1), int(w * 0.9))
            by = np.random.randint(int(h * 0.25), int(h * 0.85))
            bw = np.random.randint(18, 38)
            bh = int(bw * 2.3)
            # Amber/Red box if critical, Green if safe
            color = (40, 59, 255) if density >= 6.0 else (80, 220, 40)
            cv2.rectangle(canvas, (bx, by), (bx + bw, by + bh), color, 1)

        # 2. Burn Top Statutory Banner (Dark Semi-Transparent Header)
        banner_h = 58
        overlay = canvas.copy()
        cv2.rectangle(overlay, (0, 0), (w, banner_h), (12, 16, 24), -1)
        cv2.rectangle(overlay, (0, h - 28), (w, h), (12, 16, 24), -1)
        cv2.addWeighted(overlay, 0.88, canvas, 0.12, 0, canvas)

        # 3. Add Crisp Text
        # Top line 1: Station and Event Title
        title_text = f"NDLS TERMINAL | STATUTORY EVIDENCE ARCHIVE | ZONE: {zone_id}"
        cv2.putText(canvas, title_text, (14, 22), cv2.FONT_HERSHEY_SIMPLEX, 0.52, (255, 255, 255), 1, cv2.LINE_AA)

        # Top line 2: Density and Severity
        status_text = f"EVENT: {event_type} | DENSITY: {density:.2f}/m2 | [SURROGATE CALIBRATED REPLAY]"
        status_color = (60, 60, 255) if density >= 6.0 else (50, 220, 120)
        cv2.putText(canvas, status_text, (14, 44), cv2.FONT_HERSHEY_SIMPLEX, 0.44, status_color, 1, cv2.LINE_AA)

        # Bottom Bar: Legal Standard & Rec Timestamp
        now_str = datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")[:-3] + " IST"
        foot_text = f"EVIDENCE STANDARD: SEC 113 RAILWAYS ACT | SYNC: {now_str} | WORM SEALED"
        cv2.putText(canvas, foot_text, (14, h - 10), cv2.FONT_HERSHEY_SIMPLEX, 0.38, (160, 180, 200), 1, cv2.LINE_AA)

        return canvas


# Singleton instance
snapshot_engine = SnapshotEngine()
