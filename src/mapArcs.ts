import { geoInterpolate, type GeoProjection } from "d3-geo";

interface LonLatPoint {
  lon: number;
  lat: number;
}

interface ScreenPoint {
  x: number;
  y: number;
}

interface BuildVisibleLiftedArcPathInput {
  start: LonLatPoint;
  end: LonLatPoint;
  projection: GeoProjection;
  isVisible: (lon: number, lat: number) => boolean;
  center?: ScreenPoint;
  liftFactor?: number;
  sampleCount?: number;
}

function getQuadraticPoint(start: ScreenPoint, control: ScreenPoint, end: ScreenPoint, t: number): ScreenPoint {
  const oneMinusT = 1 - t;
  return {
    x: oneMinusT * oneMinusT * start.x + 2 * oneMinusT * t * control.x + t * t * end.x,
    y: oneMinusT * oneMinusT * start.y + 2 * oneMinusT * t * control.y + t * t * end.y,
  };
}

function toSvgPath(points: ScreenPoint[]): string | null {
  if (points.length < 2) {
    return null;
  }

  return points.reduce((path, point, index) => {
    const command = index === 0 ? "M" : "L";
    return `${path}${index === 0 ? "" : " "}${command} ${point.x} ${point.y}`;
  }, "");
}

export function buildVisibleLiftedArcPath(input: BuildVisibleLiftedArcPathInput): string | null {
  const {
    start,
    end,
    projection,
    isVisible,
    center = { x: 400, y: 300 },
    liftFactor = 0.8,
    sampleCount = 64,
  } = input;

  const projectedStart = projection([start.lon, start.lat]);
  const projectedEnd = projection([end.lon, end.lat]);

  if (!projectedStart || !projectedEnd) {
    return null;
  }

  const startPoint = { x: projectedStart[0], y: projectedStart[1] };
  const endPoint = { x: projectedEnd[0], y: projectedEnd[1] };
  const midX = (startPoint.x + endPoint.x) / 2;
  const midY = (startPoint.y + endPoint.y) / 2;
  const control = {
    x: midX + (midX - center.x) * liftFactor,
    y: midY + (midY - center.y) * liftFactor,
  };

  const interpolate = geoInterpolate([start.lon, start.lat], [end.lon, end.lat]);
  const visiblePoints: ScreenPoint[] = [];

  for (let step = 0; step <= sampleCount; step += 1) {
    const t = step / sampleCount;
    const [lon, lat] = interpolate(t);

    if (!isVisible(lon, lat)) {
      continue;
    }

    visiblePoints.push(getQuadraticPoint(startPoint, control, endPoint, t));
  }

  return toSvgPath(visiblePoints);
}
