import argparse
import json
import statistics
import sys

import cv2


def clamp(value: float, minimum: float, maximum: float) -> float:
    return max(minimum, min(maximum, value))


def parse_args():
    parser = argparse.ArgumentParser()

    parser.add_argument(
        "--video",
        required=True,
    )

    parser.add_argument(
        "--start",
        type=float,
        required=True,
    )

    parser.add_argument(
        "--end",
        type=float,
        required=True,
    )

    parser.add_argument(
        "--samples",
        type=int,
        default=10,
    )

    return parser.parse_args()


def detect_faces(frame):
    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY,
    )

    gray = cv2.equalizeHist(gray)

    frontal_path = (
        cv2.data.haarcascades
        + "haarcascade_frontalface_default.xml"
    )

    profile_path = (
        cv2.data.haarcascades
        + "haarcascade_profileface.xml"
    )

    frontal_detector = cv2.CascadeClassifier(
        frontal_path
    )

    profile_detector = cv2.CascadeClassifier(
        profile_path
    )

    faces = []

    frontal_faces = (
        frontal_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=5,
            minSize=(40, 40),
        )
    )

    for x, y, width, height in frontal_faces:
        faces.append(
            (
                int(x),
                int(y),
                int(width),
                int(height),
            )
        )

    profile_faces = (
        profile_detector.detectMultiScale(
            gray,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(40, 40),
        )
    )

    for x, y, width, height in profile_faces:
        faces.append(
            (
                int(x),
                int(y),
                int(width),
                int(height),
            )
        )

    # Le détecteur de profil reconnaît mieux
    # une orientation que l'autre.
    # On teste donc aussi l'image miroir.
    flipped = cv2.flip(
        gray,
        1,
    )

    flipped_faces = (
        profile_detector.detectMultiScale(
            flipped,
            scaleFactor=1.1,
            minNeighbors=4,
            minSize=(40, 40),
        )
    )

    frame_width = frame.shape[1]

    for x, y, width, height in flipped_faces:
        original_x = (
            frame_width
            - int(x)
            - int(width)
        )

        faces.append(
            (
                original_x,
                int(y),
                int(width),
                int(height),
            )
        )

    return faces


def main():
    args = parse_args()

    if args.start < 0:
        raise ValueError(
            "start must be >= 0"
        )

    if args.end <= args.start:
        raise ValueError(
            "end must be greater than start"
        )

    if args.samples < 1:
        raise ValueError(
            "samples must be >= 1"
        )

    capture = cv2.VideoCapture(
        args.video
    )

    if not capture.isOpened():
        raise RuntimeError(
            "Unable to open video."
        )

    duration = (
        args.end
        - args.start
    )

    centers_x = []
    centers_y = []

    face_width_ratios = []
    face_height_ratios = []

    sampled_frames = 0

    # On évite volontairement les toutes
    # premières et dernières frames du clip.
    for index in range(args.samples):
        ratio = (
            (index + 1)
            / (args.samples + 1)
        )

        timestamp = (
            args.start
            + duration * ratio
        )

        capture.set(
            cv2.CAP_PROP_POS_MSEC,
            timestamp * 1000,
        )

        success, frame = capture.read()

        if not success:
            continue

        sampled_frames += 1

        frame_height, frame_width = (
            frame.shape[:2]
        )

        faces = detect_faces(
            frame
        )

        if len(faces) == 0:
            continue

        # Pour notre V1 :
        # le plus grand visage est considéré
        # comme le sujet principal.
        largest_face = max(
            faces,
            key=lambda face:
                face[2] * face[3],
        )

        x, y, width, height = (
            largest_face
        )

        center_x = (
            x + width / 2
        ) / frame_width

        center_y = (
            y + height / 2
        ) / frame_height

        centers_x.append(center_x)
        centers_y.append(center_y)

        face_width_ratios.append(
            width / frame_width
        )

        face_height_ratios.append(
            height / frame_height
        )

    capture.release()

    detection_count = len(
        centers_x
    )

    if detection_count == 0:
        result = {
            "strategy": "center",
            "focusX": 0.5,
            "focusY": 0.5,
            "faceWidthRatio": 0.0,
            "faceHeightRatio": 0.0,
            "sampleCount": sampled_frames,
            "detectionCount": 0,
        }

    else:
        result = {
            "strategy": "face",
            "focusX": clamp(
                statistics.median(
                    centers_x
                ),
                0.0,
                1.0,
            ),
            "focusY": clamp(
                statistics.median(
                    centers_y
                ),
                0.0,
                1.0,
            ),
            "faceWidthRatio":
                statistics.median(
                    face_width_ratios
                ),
            "faceHeightRatio":
                statistics.median(
                    face_height_ratios
                ),
            "sampleCount":
                sampled_frames,
            "detectionCount":
                detection_count,
        }

    print(
        json.dumps(result)
    )


if __name__ == "__main__":
    try:
        main()

    except Exception as error:
        print(
            str(error),
            file=sys.stderr,
        )

        sys.exit(1)