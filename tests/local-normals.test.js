import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { buildVertexFaceIndex, updateVertexNormalsLocally } from '../src/local-normals.js';

function quad() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0, 3, 3, 0
  ], 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  return geometry;
}

test('locally recalculated normals match a full normal rebuild', () => {
  const geometry = quad();
  const reference = geometry.clone();
  const position = geometry.getAttribute('position');
  position.setZ(1, 0.6);
  reference.getAttribute('position').setZ(1, 0.6);

  const topology = buildVertexFaceIndex(geometry);
  const affected = updateVertexNormalsLocally(geometry, [1], topology);
  reference.computeVertexNormals();

  assert.deepEqual([...affected].sort((a, b) => a - b), [0, 1, 2]);
  const actual = geometry.getAttribute('normal').array;
  const expected = reference.getAttribute('normal').array;
  for (let i = 0; i < actual.length; i++) assert.ok(Math.abs(actual[i] - expected[i]) < 1e-6);
});

test('supports non-indexed triangle geometry', () => {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
  geometry.computeVertexNormals();
  const affected = updateVertexNormalsLocally(geometry, [0]);
  assert.deepEqual(affected, [0, 1, 2]);
});

