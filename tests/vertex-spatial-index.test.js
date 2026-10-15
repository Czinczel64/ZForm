import test from 'node:test';
import assert from 'node:assert/strict';
import { VertexSpatialIndex } from '../src/vertex-spatial-index.js';

function position(points) {
  return {
    points,
    count: points.length,
    getX: (i) => points[i][0],
    getY: (i) => points[i][1],
    getZ: (i) => points[i][2]
  };
}

test('returns only vertices inside the brush radius, including negative coordinates', () => {
  const positions = position([[-0.15, 0, 0], [0.15, 0, 0], [0.45, 0, 0], [0, 0.5, 0]]);
  const index = new VertexSpatialIndex(positions, 0.2);
  assert.deepEqual(index.querySphere({ x: 0, y: 0, z: 0 }, 0.2).sort(), [0, 1]);
});

test('moving a sculpted vertex updates its spatial cell', () => {
  const positions = position([[0, 0, 0], [1, 0, 0]]);
  const index = new VertexSpatialIndex(positions, 0.25);
  assert.deepEqual(index.querySphere({ x: 1, y: 0, z: 0 }, 0.1), [1]);
  positions.points[0] = [1.05, 0, 0];
  index.updateVertex(0, 1.05, 0, 0);
  assert.deepEqual(index.querySphere({ x: 1, y: 0, z: 0 }, 0.1).sort(), [0, 1]);
  assert.deepEqual(index.querySphere({ x: 0, y: 0, z: 0 }, 0.1), []);
});

test('rejects invalid cell size', () => {
  assert.throws(() => new VertexSpatialIndex(position([]), 0), /positivo/);
});

