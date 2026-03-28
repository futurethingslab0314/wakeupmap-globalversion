import assert from "node:assert/strict";
import test from "node:test";
import { geoOrthographic } from "d3-geo";
import { buildVisibleLiftedArcPath, buildVisibleLiftedArcSegments } from "../mapArcs";

function createProjection() {
  const projection = geoOrthographic()
    .scale(320)
    .rotate([0, 0, 0])
    .translate([400, 300]);

  const isVisible = (lon: number, lat: number) => {
    const r = projection.rotate();
    const lambda = (lon * Math.PI) / 180;
    const phi = (lat * Math.PI) / 180;
    const lambda0 = (r[0] * Math.PI) / 180;
    const phi0 = (r[1] * Math.PI) / 180;
    const cosC =
      Math.sin(-phi0) * Math.sin(phi) +
      Math.cos(-phi0) * Math.cos(phi) * Math.cos(lambda - -lambda0);
    return cosC > 0;
  };

  return { projection, isVisible };
}

test("buildVisibleLiftedArcSegments keeps a visible front-side segment when the route crosses behind the globe", () => {
  const { projection, isVisible } = createProjection();

  const segments = buildVisibleLiftedArcSegments({
    start: { lon: 0, lat: 0 },
    end: { lon: 120, lat: 0 },
    projection,
    isVisible,
  });

  assert.ok(segments.length >= 1, "expected at least one visible segment");
  assert.ok(segments[0].length >= 2, "expected the visible segment to contain sampled points");
});

test("buildVisibleLiftedArcSegments keeps endpoints anchored when both cities are visible", () => {
  const { projection, isVisible } = createProjection();

  const segments = buildVisibleLiftedArcSegments({
    start: { lon: 0, lat: 0 },
    end: { lon: 60, lat: 20 },
    projection,
    isVisible,
  });

  assert.equal(segments.length, 1);

  const startProjection = projection([0, 0]);
  const endProjection = projection([60, 20]);
  assert.ok(startProjection);
  assert.ok(endProjection);

  const firstPoint = segments[0][0];
  const lastPoint = segments[0][segments[0].length - 1];

  assert.ok(Math.abs(firstPoint.x - startProjection[0]) < 1);
  assert.ok(Math.abs(firstPoint.y - startProjection[1]) < 1);
  assert.ok(Math.abs(lastPoint.x - endProjection[0]) < 1);
  assert.ok(Math.abs(lastPoint.y - endProjection[1]) < 1);
});

test("buildVisibleLiftedArcSegments creates a lifted path instead of hugging the surface midpoint", () => {
  const { projection, isVisible } = createProjection();

  const segments = buildVisibleLiftedArcSegments({
    start: { lon: 0, lat: 0 },
    end: { lon: 60, lat: 0 },
    projection,
    isVisible,
  });

  assert.equal(segments.length, 1);

  const midpoint = segments[0][Math.floor(segments[0].length / 2)];
  const surfaceMidpoint = projection([30, 0]);
  assert.ok(surfaceMidpoint);

  const liftedRadius = Math.hypot(midpoint.x - 400, midpoint.y - 300);
  const surfaceRadius = Math.hypot(surfaceMidpoint[0] - 400, surfaceMidpoint[1] - 300);

  assert.ok(liftedRadius > surfaceRadius, "expected the 3D arc midpoint to rise away from the sphere");
});

test("buildVisibleLiftedArcPath still returns a usable SVG path wrapper", () => {
  const { projection, isVisible } = createProjection();

  const path = buildVisibleLiftedArcPath({
    start: { lon: 0, lat: 0 },
    end: { lon: 120, lat: 0 },
    projection,
    isVisible,
  });

  assert.ok(path, "expected a partial visible arc instead of dropping the full segment");
});

test("buildVisibleLiftedArcPath still returns a path when both endpoints are visible", () => {
  const { projection, isVisible } = createProjection();

  const path = buildVisibleLiftedArcPath({
    start: { lon: 0, lat: 0 },
    end: { lon: 60, lat: 20 },
    projection,
    isVisible,
  });

  assert.ok(path);
});
