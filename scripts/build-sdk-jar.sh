#!/usr/bin/env bash
# Builds the Vision Java SDK and puts the jar and its pom into dist/sdk-java/.
# Needs JDK 11-17 and Gradle 7.x on PATH. The jar runs on Java 11 and later.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VERSION="${1:-4.3.1-vision.2}"
OUT="$ROOT/dist/sdk-java"
REPO="$(mktemp -d)"
trap 'rm -rf "$REPO"' EXIT

cd "$ROOT/sdk-java"
gradle clean test publishSdkPublicationToCompanyRepository \
  -PpublishVersion="$VERSION" -PrepoUrl="file://$REPO" --no-daemon -q

mkdir -p "$OUT"
rm -f "$OUT"/sdk-java-*.jar "$OUT"/sdk-java-*.pom
cp "$REPO/com/github/Visual-Regression-Tracker/sdk-java/$VERSION/sdk-java-$VERSION.jar" "$OUT/"
cp "$REPO/com/github/Visual-Regression-Tracker/sdk-java/$VERSION/sdk-java-$VERSION.pom" "$OUT/"
echo "Built $OUT/sdk-java-$VERSION.jar"
