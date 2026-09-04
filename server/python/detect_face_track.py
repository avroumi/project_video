import argparse
import json
import sys

import cv2


def clamp(
    value: float,
    minimum: float,
    maximum: float,
) -> float:
    return max(
        minimum,
        min(maximum, value),
    )


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
        "--interval",
        type=float,
        default=0.75,
    )

    return parser.parse_args()


def rectangle_area(face):
    _, _, width, height = face
    return width * height


def face_center_x(
    face,
    frame_width: int,
) -> float:
    x, _, width, _ = face

    return (
        x + width / 2
    ) / frame_width


def intersection_over_union(
    first,
    second,
) -> float:
    x1, y1, w1, h1 = first
    x2, y2, w2, h2 = second

    left = max(x1, x2)
    top = max(y1, y2)

    right = min(
        x1 + w1,
        x2 + w2,
    )

    bottom = min(
        y1 + h1,
        y2 + h2,
    )

    intersection_width = max(
        0,
        right - left,
    )

    intersection_height = max(
        0,
        bottom - top,
    )

    intersection_area = (
        intersection_width
        * intersection_height
    )

    if intersection_area == 0:
        return 0.0

    first_area = w1 * h1
    second_area = w2 * h2

    union_area = (
        first_area
        + second_area
        - intersection_area
    )

    if union_area <= 0:
        return 0.0

    return (
        intersection_area
        / union_area
    )


def deduplicate_faces(faces):
    sorted_faces = sorted(
        faces,
        key=rectangle_area,
        reverse=True,
    )

    kept = []

    for face in sorted_faces:
        duplicate = any(
            intersection_over_union(
                face,
                existing,
            ) > 0.35
            for existing in kept
        )

        if not duplicate:
            kept.append(face)

    return kept


def detect_faces(
    frame,
    frontal_detector,
    profile_detector,
):
    gray = cv2.cvtColor(
        frame,
        cv2.COLOR_BGR2GRAY,
    )

    gray = cv2.equalizeHist(
        gray,
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

    return deduplicate_faces(
        faces,
    )


def choose_face(
    faces,
    frame_width: int,
    previous_focus_x,
):
    if len(faces) == 0:
        return None

    if previous_focus_x is None:
        return max(
            faces,
            key=rectangle_area,
        )

    largest_area = max(
        rectangle_area(face)
        for face in faces
    )

    def score(face):
        center_x = face_center_x(
            face,
            frame_width,
        )

        distance = abs(
            center_x
            - previous_focus_x
        )

        area = rectangle_area(
            face,
        )

        size_penalty = (
            1
            - area / largest_area
        )

        return (
            distance
            + size_penalty * 0.15
        )

    return min(
        faces,
        key=score,
    )


def reject_outliers(points):
    if len(points) <= 1:
        return points

    accepted = [
        points[0],
    ]

    for point in points[1:]:
        previous = accepted[-1]

        time_difference = max(
            point["time"]
            - previous["time"],
            0.001,
        )

        maximum_jump = max(
            0.12,
            0.25
            * time_difference,
        )

        difference = abs(
            point["focusX"]
            - previous["focusX"]
        )

        if difference <= maximum_jump:
            accepted.append(
                point,
            )

    return accepted


def smooth_points(points):
    if len(points) == 0:
        return []

    alpha = 0.30

    smoothed = []

    previous_x = points[0][
        "focusX"
    ]

    smoothed.append(
        {
            "time":
                points[0]["time"],
            "focusX":
                previous_x,
        }
    )

    for point in points[1:]:
        current_x = (
            alpha
            * point["focusX"]
            + (1 - alpha)
            * previous_x
        )

        previous_x = current_x

        smoothed.append(
            {
                "time":
                    point["time"],
                "focusX":
                    current_x,
            }
        )

    return smoothed


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

    if args.interval <= 0:
        raise ValueError(
            "interval must be > 0"
        )

    frontal_detector = (
        cv2.CascadeClassifier(
            cv2.data.haarcascades
            + "haarcascade_frontalface_default.xml"
        )
    )

    profile_detector = (
        cv2.CascadeClassifier(
            cv2.data.haarcascades
            + "haarcascade_profileface.xml"
        )
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

    raw_points = []

    sample_count = 0
    detection_count = 0

    previous_focus_x = None

    current_time = args.start

    while current_time <= args.end:
        capture.set(
            cv2.CAP_PROP_POS_MSEC,
            current_time * 1000,
        )

        success, frame = (
            capture.read()
        )

        if not success:
            current_time += (
                args.interval
            )
            continue

        sample_count += 1

        frame_width = (
            frame.shape[1]
        )

        faces = detect_faces(
            frame,
            frontal_detector,
            profile_detector,
        )

        face = choose_face(
            faces,
            frame_width,
            previous_focus_x,
        )

        if face is not None:
            focus_x = clamp(
                face_center_x(
                    face,
                    frame_width,
                ),
                0.0,
                1.0,
            )

            detection_count += 1

            raw_points.append(
                {
                    "time":
                        current_time
                        - args.start,
                    "focusX":
                        focus_x,
                }
            )

            previous_focus_x = (
                focus_x
            )

        current_time += (
            args.interval
        )

    capture.release()

    detection_rate = (
        detection_count
        / sample_count
        if sample_count > 0
        else 0.0
    )

    filtered_points = (
        reject_outliers(
            raw_points,
        )
    )

    smoothed_points = (
        smooth_points(
            filtered_points,
        )
    )

    if (
        detection_rate < 0.40
        or len(smoothed_points) < 2
    ):
        result = {
            "strategy":
                "center",
            "durationSeconds":
                duration,
            "sampleCount":
                sample_count,
            "detectionCount":
                detection_count,
            "acceptedCount":
                len(smoothed_points),
            "detectionRate":
                detection_rate,
            "points": [
                {
                    "time": 0.0,
                    "focusX": 0.5,
                },
                {
                    "time":
                        duration,
                    "focusX": 0.5,
                },
            ],
        }

    else:
        first_x = (
            smoothed_points[0][
                "focusX"
            ]
        )

        last_x = (
            smoothed_points[-1][
                "focusX"
            ]
        )

        points = [
            {
                "time": 0.0,
                "focusX":
                    first_x,
            }
        ]

        for point in smoothed_points:
            if point["time"] <= 0:
                continue

            if point["time"] >= duration:
                continue

            points.append(
                point
            )

        points.append(
            {
                "time":
                    duration,
                "focusX":
                    last_x,
            }
        )

        result = {
            "strategy":
                "dynamic_face",
            "durationSeconds":
                duration,
            "sampleCount":
                sample_count,
            "detectionCount":
                detection_count,
            "acceptedCount":
                len(smoothed_points),
            "detectionRate":
                detection_rate,
            "points":
                points,
        }

    print(
        json.dumps(
            result,
        )
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