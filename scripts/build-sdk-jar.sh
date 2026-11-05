#!/usr/bin/env bash
# Builds the Vision Java SDK and puts the jar and its pom into dist/sdk-java/.
# Needs JDK 11-17 and Gradle 7.x on PATH. The jar runs on Java 11 and later.
#
#   ./scripts/build-sdk-jar.sh            the version in sdk-java/build.gradle
#   ./scripts/build-sdk-jar.sh 1.0.1      another one
#   VISION_GRADLE_FLAGS=--offline ...     without the network (Gradle's cache must hold the dependencies)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# coordinates since 040 (ADR-0026); the version lives in build.gradle
GROUP_PATH="ua/vision"
ARTIFACT="vision-sdk"
VERSION="${1:-$(sed -n "s/^version '\(.*\)'$/\1/p" "$ROOT/sdk-java/build.gradle")}"
[ -n "$VERSION" ] || { echo "No version in sdk-java/build.gradle" >&2; exit 1; }
OUT="$ROOT/dist/sdk-java"
REPO="$(mktemp -d)"
trap 'rm -rf "$REPO"' EXIT

cd "$ROOT/sdk-java"
# shellcheck disable=SC2086
gradle clean test publishSdkPublicationToCompanyRepository ${VISION_GRADLE_FLAGS:-} \
  -PpublishVersion="$VERSION" -PrepoUrl="file://$REPO" --no-daemon -q

mkdir -p "$OUT"
# the jar of the old coordinates goes too: one SDK in dist/, under its own name
rm -f "$OUT"/sdk-java-*.jar "$OUT"/sdk-java-*.pom "$OUT"/$ARTIFACT-*.jar "$OUT"/$ARTIFACT-*.pom
cp "$REPO/$GROUP_PATH/$ARTIFACT/$VERSION/$ARTIFACT-$VERSION.jar" "$OUT/"
cp "$REPO/$GROUP_PATH/$ARTIFACT/$VERSION/$ARTIFACT-$VERSION.pom" "$OUT/"
echo "Built $OUT/$ARTIFACT-$VERSION.jar"
