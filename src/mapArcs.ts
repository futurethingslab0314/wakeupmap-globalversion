import { geoInterpolate, geoRotation, type GeoProjection } from "d3-geo";

interface LonLatPoint {
  lon: number;
  lat: number;
}

export interface ProjectedArcPoint {
  x: number;
  y: number;
}

export type ProjectedArcSegment = ProjectedArcPoint[];

interface BuildVisibleLiftedArcPathInput {
  start: LonLatPoint;
  end: LonLatPoint;
  projection: GeoProjection;
  isVisible?: (lon: number, lat: number) => boolean;
  liftFactor?: number;
  sampleCount?: number;
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function getAngularDistance(start: LonLatPoint, end: LonLatPoint): number {
  const startLon = toRadians(start.lon);
  const startLat = toRadians(start.lat);
  const endLon = toRadians(end.lon);
  const endLat = toRadians(end.lat);

  const cosine =
    Math.sin(startLat) * Math.sin(endLat) +
    Math.cos(startLat) * Math.cos(endLat) * Math.cos(endLon - startLon);

  return Math.acos(Math.min(1, Math.max(-1, cosine)));
}

function getLiftScale(distanceRadians: number, t: number, liftFactor: number): number {
  const midpointEnvelope = Math.sin(Math.PI * t);
  const distanceWeight = 0.06 + 0.22 * Math.sin(Math.min(distanceRadians, Math.PI) / 2);
  return 1 + midpointEnvelope * distanceWeight * liftFactor;
}

function projectLiftedPoint(
  lon: number,
  lat: number,
  projection: GeoProjection,
  liftScale: number,
): { point: ProjectedArcPoint; visible: boolean } | null {
  const scale = projection.scale();
  const [translateX, translateY] = projection.translate();
  const rotate = geoRotation(projection.rotate());
  const [rotatedLon, rotatedLat] = rotate([lon, lat]);

  const lambda = toRadians(rotatedLon);
  const phi = toRadians(rotatedLat);
  const cosPhi = Math.cos(phi);
  const x = cosPhi * Math.sin(lambda);
  const y = -Math.sin(phi);
  const z = cosPhi * Math.cos(lambda);

  if ([x, y, z].some((value) => Number.isNaN(value))) {
    return null;
  }

  const liftedX = x * liftScale;
  const liftedY = y * liftScale;
  const liftedZ = z * liftScale;
  const projectedRadiusSquared = liftedX * liftedX + liftedY * liftedY;
  const horizonZ = projectedRadiusSquared < 1 ? Math.sqrt(1 - projectedRadiusSquared) : null;
  const visible = horizonZ === null || liftedZ >= horizonZ;

  return {
    point: {
      x: translateX + scale * liftedX,
      y: translateY + scale * liftedY,
    },
    visible,
  };
}

export function toSvgPath(points: ProjectedArcPoint[]): string | null {
  if (points.length < 2) {
    return null;
  }

  return points.reduce((path, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${path}${index === 0 ? "" : " "}${command} ${point.x} ${point.y}`;
  }, "");
}

export function buildVisibleLiftedArcSegments(input: BuildVisibleLiftedArcPathInput): ProjectedArcSegment[] {
  const {
    start,
    end,
    projection,
    isVisible,
    liftFactor = 1,
    sampleCount = 72,
  } = input;

  const interpolate = geoInterpolate([start.lon, start.lat], [end.lon, end.lat]);
  const distanceRadians = getAngularDistance(start, end);
  const segments: ProjectedArcSegment[] = [];
  let currentSegment: ProjectedArcSegment = [];

  for (let step = 0; step <= sampleCount; step += 1) {
    const t = step / sampleCount;
    const [lon, lat] = interpolate(t);

    if (isVisible && !isVisible(lon, lat) && step !== 0 && step !== sampleCount) {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      continue;
    }

    const liftedPoint = projectLiftedPoint(lon, lat, projection, getLiftScale(distanceRadians, t, liftFactor));
    if (!liftedPoint || !liftedPoint.visible) {
      if (currentSegment.length >= 2) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      continue;
    }

    currentSegment.push(liftedPoint.point);
  }

  if (currentSegment.length >= 2) {
    segments.push(currentSegment);
  }

  return segments;
}

export function buildVisibleLiftedArcPath(input: BuildVisibleLiftedArcPathInput): string | null {
  const paths = buildVisibleLiftedArcSegments(input)
    .map((segment) => toSvgPath(segment))
    .filter((segmentPath): segmentPath is string => !!segmentPath);

  if (paths.length === 0) {
    return null;
  }

  return paths.join(" ");
}
