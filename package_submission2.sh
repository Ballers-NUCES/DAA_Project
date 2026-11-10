#!/usr/bin/env bash

set -euo pipefail

readonly MAX_DATASET_FILE_BYTES=1000000
readonly PACKAGE_NAME="Submission2"

usage() {
  cat <<'EOF'
Usage: ./package_submission2.sh [options]

Packages Submission 2 (Parts 2, 3, and 4) with:
  - S2 source code, excluding every file ignored by Git
  - Nice_UI.png
  - optional datasets, including only files strictly smaller than 1 MB
  - optional executable of any file type

Options:
  -d, --datasets DIR       Dataset folder to include
  -e, --executable FILE    Executable or bundle to include
  -o, --output FILE        Output zip path (default: timestamped Submission2 zip)
  -h, --help               Show this help

Examples:
  ./package_submission2.sh
  ./package_submission2.sh --datasets "/path/to/Datasets"
  ./package_submission2.sh -d "/path/to/Datasets" -e "/path/to/app.exe"
  ./package_submission2.sh -d "/path/to/Datasets" -e "/path/to/app.AppImage" -o Submission2.zip
EOF
}

fail() {
  printf 'Error: %s\n' "$1" >&2
  exit 1
}

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
CALLER_DIR="$PWD"
DATASET_INPUT=""
EXECUTABLE=""
OUTPUT_INPUT="$SCRIPT_DIR/${PACKAGE_NAME}_$(date +%Y%m%d_%H%M%S).zip"

while (($# > 0)); do
  case "$1" in
    -d|--datasets)
      (($# >= 2)) || fail "$1 requires a directory path"
      DATASET_INPUT="$2"
      shift 2
      ;;
    -e|--executable)
      (($# >= 2)) || fail "$1 requires a file path"
      EXECUTABLE="$2"
      shift 2
      ;;
    -o|--output)
      (($# >= 2)) || fail "$1 requires an output path"
      OUTPUT_INPUT="$2"
      shift 2
      ;;
    -h|--help)
      usage
      exit 0
      ;;
    *)
      fail "unknown option: $1 (use --help for usage)"
      ;;
  esac
done

for command_name in git zip find sort stat; do
  command -v "$command_name" >/dev/null 2>&1 || fail "required command not found: $command_name"
done

[[ -d "$SCRIPT_DIR/S2" ]] || fail "S2 source folder not found beside the script"
[[ -f "$SCRIPT_DIR/Nice_UI.png" ]] || fail "Nice_UI.png not found beside the script"
git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1 \
  || fail "the project must be inside a Git work tree so ignore rules can be applied"

DATASET_DIR=""
if [[ -n "$DATASET_INPUT" ]]; then
  [[ -d "$DATASET_INPUT" ]] || fail "dataset folder does not exist: $DATASET_INPUT"
  DATASET_DIR="$(cd -- "$DATASET_INPUT" && pwd)"
fi

if [[ -n "$EXECUTABLE" ]]; then
  [[ -f "$EXECUTABLE" ]] || fail "executable file does not exist: $EXECUTABLE"
fi

if [[ "$OUTPUT_INPUT" = /* ]]; then
  OUTPUT="$OUTPUT_INPUT"
else
  OUTPUT="$CALLER_DIR/$OUTPUT_INPUT"
fi
[[ ! -e "$OUTPUT" ]] || fail "output already exists: $OUTPUT"
[[ -d "$(dirname -- "$OUTPUT")" ]] || fail "output directory does not exist: $(dirname -- "$OUTPUT")"

WORK_DIR="$(mktemp -d "${TMPDIR:-/tmp}/submission2.XXXXXXXX")"
trap 'rm -rf -- "$WORK_DIR"' EXIT
PACKAGE_ROOT="$WORK_DIR/$PACKAGE_NAME"
mkdir -p "$PACKAGE_ROOT/Source Code"

SOURCE_COUNT=0
while IFS= read -r -d '' relative_path; do
  destination="$PACKAGE_ROOT/Source Code/$relative_path"
  mkdir -p "$(dirname -- "$destination")"
  cp -p -- "$SCRIPT_DIR/$relative_path" "$destination"
  SOURCE_COUNT=$((SOURCE_COUNT + 1))
done < <(git -C "$SCRIPT_DIR" ls-files -z --cached --others --exclude-standard -- S2)

((SOURCE_COUNT > 0)) || fail "no non-ignored S2 source files were found"
cp -p -- "$SCRIPT_DIR/Nice_UI.png" "$PACKAGE_ROOT/Nice_UI.png"

DATASET_INCLUDED=0
DATASET_OMITTED=0

if [[ -n "$DATASET_DIR" ]]; then
  mkdir -p "$PACKAGE_ROOT/Datasets"

  while IFS= read -r -d '' source_file; do
    relative_path="${source_file#"$DATASET_DIR"/}"
    file_size="$(stat -c %s -- "$source_file")"

    if ((file_size < MAX_DATASET_FILE_BYTES)); then
      destination="$PACKAGE_ROOT/Datasets/$relative_path"
      mkdir -p "$(dirname -- "$destination")"
      cp -p -- "$source_file" "$destination"
      DATASET_INCLUDED=$((DATASET_INCLUDED + 1))
    else
      DATASET_OMITTED=$((DATASET_OMITTED + 1))
    fi
  done < <(find "$DATASET_DIR" -type f -print0 | sort -z)
fi

EXECUTABLE_NAME="Not supplied"
if [[ -n "$EXECUTABLE" ]]; then
  mkdir -p "$PACKAGE_ROOT/Executable"
  EXECUTABLE_NAME="$(basename -- "$EXECUTABLE")"
  cp -p -- "$EXECUTABLE" "$PACKAGE_ROOT/Executable/$EXECUTABLE_NAME"
fi

(
  cd "$WORK_DIR"
  zip -q -r -y "$OUTPUT" "$PACKAGE_NAME"
)

printf 'Created: %s\n' "$OUTPUT"
printf 'Source files: %s (Git-ignored files excluded)\n' "$SOURCE_COUNT"
if [[ -n "$DATASET_DIR" ]]; then
  printf 'Datasets: %s included, %s omitted for size\n' "$DATASET_INCLUDED" "$DATASET_OMITTED"
else
  printf 'Datasets: not supplied\n'
fi
printf 'Executable: %s\n' "$EXECUTABLE_NAME"
