"""
Converts CarDD's COCO-format annotations (train.json / val.json / test.json)
into YOLO-format label .txt files, and writes the data.yaml YOLOv8 needs.

CarDD ships as COCO (categories/images/annotations) with bounding boxes for
the detection task, so this is a bbox-only conversion -- segmentation
polygons are ignored since YOLO() for detection only needs boxes.

Expected input layout (adjust CARDD_ROOT if yours differs):

    CarDD-data/
        train.json
        val.json
        test.json
        train/   <images referenced by train.json>
        val/     <images referenced by val.json>
        test/    <images referenced by test.json>

Output layout (written under YOLO_ROOT):

    cardd_yolo/
        images/{train,val,test}/*.jpg   (symlinked, not copied)
        labels/{train,val,test}/*.txt
        data.yaml
"""

import json
import os
from pathlib import Path
import shutil

# --- Where the dataset lives -------------------------------
# CARDD_ROOT = Path("./CarDD-data") 
# YOLO_ROOT = Path("./cardd_yolo")  # where to write YOLOv8 label files and data.yaml
# Running on kaggle, the dataset is in /kaggle/input/datasets/issamjebnouni/cardd and we write to /kaggle/working/cardd_yolo
CARDD_ROOT = Path("/kaggle/input/datasets/issamjebnouni/cardd") 
YOLO_ROOT = Path("/kaggle/working/cardd_yolo")  # where to write YOLOv8 label files and data.yaml
# -----------------------------------------------------------------------------

SPLITS = {
    "train": "train.json",
    "val": "val.json",
    "test": "test.json",
}

# CarDD's six fine-grained damage categories, in a fixed, stable order.
# We re-map COCO category_id -> this 0-indexed order rather than trusting
# raw category_id values, since COCO ids aren't guaranteed contiguous from 0.
CLASS_NAMES = [
    "dent",
    "scratch",
    "crack",
    "glass shatter",
    "lamp broken",
    "tire flat",
]


def _find_image_dir(split: str) -> Path:
    """CarDD releases vary in whether images sit under CarDD-data/<split>/
    or CarDD-data/<split>/<split>/ -- check the common candidates."""
    candidates = [
        CARDD_ROOT / split,
        CARDD_ROOT / split / split,
        CARDD_ROOT / "images" / split,
    ]
    for c in candidates:
        if c.is_dir():
            return c
    raise FileNotFoundError(
        f"Couldn't find an image directory for split '{split}'. "
        f"Checked: {[str(c) for c in candidates]}. "
        "Update _find_image_dir() to match your CarDD download."
    )


def convert_split(split: str, json_name: str) -> int:
    ann_path = CARDD_ROOT / json_name
    if not ann_path.exists():
        raise FileNotFoundError(f"Missing annotation file: {ann_path}")

    with open(ann_path) as f:
        coco = json.load(f)

    cat_id_to_name = {c["id"]: c["name"].strip().lower() for c in coco["categories"]}
    name_to_idx = {n: i for i, n in enumerate(CLASS_NAMES)}

    images_by_id = {img["id"]: img for img in coco["images"]}

    anns_by_image = {}
    for ann in coco["annotations"]:
        anns_by_image.setdefault(ann["image_id"], []).append(ann)

    img_src_dir = _find_image_dir(split)
    img_out_dir = YOLO_ROOT / "images" / split
    lbl_out_dir = YOLO_ROOT / "labels" / split
    img_out_dir.mkdir(parents=True, exist_ok=True)
    lbl_out_dir.mkdir(parents=True, exist_ok=True)

    written = 0
    skipped_missing_image = 0

    for image_id, img_info in images_by_id.items():
        file_name = img_info["file_name"]
        w, h = img_info["width"], img_info["height"]

        src_img = img_src_dir / file_name
        if not src_img.exists():
            skipped_missing_image += 1
            continue

        # symlink instead of copy -- avoids duplicating multi-GB of images
        dst_img = img_out_dir / file_name
        if not dst_img.exists():
            shutil.copy2(src_img.resolve(), dst_img)

        lines = []
        for ann in anns_by_image.get(image_id, []):
            cat_name = cat_id_to_name.get(ann["category_id"])
            if cat_name not in name_to_idx:
                continue  # unexpected category, skip rather than crash
            cls_idx = name_to_idx[cat_name]

            x, y, bw, bh = ann["bbox"]  # COCO bbox: [x_min, y_min, w, h] in px
            xc = (x + bw / 2) / w
            yc = (y + bh / 2) / h
            nw = bw / w
            nh = bh / h
            lines.append(f"{cls_idx} {xc:.6f} {yc:.6f} {nw:.6f} {nh:.6f}")

        label_path = lbl_out_dir / (Path(file_name).stem + ".txt")
        label_path.write_text("\n".join(lines))
        written += 1

    if skipped_missing_image:
        print(
            f"[{split}] WARNING: {skipped_missing_image} images listed in "
            f"{json_name} were not found under {img_src_dir}"
        )
    print(f"[{split}] wrote {written} label files -> {lbl_out_dir}")
    return written


def write_data_yaml() -> Path:
    yaml_path = YOLO_ROOT / "data.yaml"
    lines = [
        f"path: {YOLO_ROOT.resolve()}",
        "train: images/train",
        "val: images/val",
        "test: images/test",
        f"nc: {len(CLASS_NAMES)}",
        "names:",
    ] + [f"  {i}: {name}" for i, name in enumerate(CLASS_NAMES)]
    yaml_path.write_text("\n".join(lines) + "\n")
    print(f"wrote {yaml_path}")
    return yaml_path


def main():
    YOLO_ROOT.mkdir(parents=True, exist_ok=True)
    for split, json_name in SPLITS.items():
        ann_path = CARDD_ROOT / json_name
        if not ann_path.exists():
            print(f"[{split}] skipping -- {ann_path} not found")
            continue
        convert_split(split, json_name)
    write_data_yaml()


if __name__ == "__main__":
    main()