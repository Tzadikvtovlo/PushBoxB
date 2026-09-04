#!/usr/bin/env bash
# PushBox - יצירת קובצי ZIP של שתי גרסאות הבטא בהורדות (Linux/macOS)
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DEST_DIR="$HOME/Downloads"
mkdir -p "$DEST_DIR"

echo "========================================================="
echo "      PushBox - יצירת קובצי ZIP לגרסאות הבטא (Beta)"
echo "========================================================="
echo "יעד: $DEST_DIR"
echo ""

# 1. גרסה 4.92 בטא
if [ -d "$SCRIPT_DIR/beta" ]; then
  echo "[1/2] יוצר את PushBox-v4.92-Beta.zip..."
  rm -f "$DEST_DIR/PushBox-v4.92-Beta.zip"
  (cd "$SCRIPT_DIR/beta" && zip -r "$DEST_DIR/PushBox-v4.92-Beta.zip" . -x "*.git*")
  echo " -> נוצר בהצלחה!"
fi

# 2. גרסה 4.65 בטא
if [ -d "$SCRIPT_DIR/beta-4.65" ]; then
  echo "[2/2] יוצר את PushBox-v4.65-Beta.zip..."
  rm -f "$DEST_DIR/PushBox-v4.65-Beta.zip"
  (cd "$SCRIPT_DIR/beta-4.65" && zip -r "$DEST_DIR/PushBox-v4.65-Beta.zip" . -x "*.git*")
  echo " -> נוצר בהצלחה!"
fi

echo ""
echo "========================================================="
echo " [הצלחה!] כל קובצי ה-ZIP של הבטא נוצרו בתיקיית ההורדות:"
echo " 1. $DEST_DIR/PushBox-v4.92-Beta.zip"
echo " 2. $DEST_DIR/PushBox-v4.65-Beta.zip"
echo "========================================================="
