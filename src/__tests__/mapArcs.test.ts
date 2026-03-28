import assert from "node:assert/strict";
import test from "node:test";
import { geoOrthographic } from "d3-geo";
import { buildVisibleLiftedArcPath } from "../mapArcs";

test("buildVisibleLiftedArcPath keeps a visible segment when the next point falls behind the globe", () => {
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

  const path = buildVisibleLiftedArcPath({
    start: { lon: 0, lat: 0 },
    end: { lon: 120, lat: 0 },
    projection,
    isVisible,
  });

  assert.ok(path, "expected a partial visible arc instead of dropping the full segment");
});

test("buildVisibleLiftedArcPath still returns a path when both endpoints are visible", () => {
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

  const path = buildVisibleLiftedArcPath({
    start: { lon: 0, lat: 0 },
    end: { lon: 60, lat: 20 },
    projection,
    isVisible,
  });

  assert.ok(path);
});
