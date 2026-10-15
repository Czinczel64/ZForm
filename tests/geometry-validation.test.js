import test from 'node:test';
import assert from 'node:assert/strict';
import { geometryValidationError } from '../src/geometry-validation.js';

function attribute(values, itemSize) {
  return { array: values, itemSize, count: values.length / itemSize };
}
function triangle() {
  return {
    getAttribute(name) {
      if (name === 'position') return attribute(new Float32Array([0, 0, 0, 1, 0, 0, 0, 1, 0]), 3);
      return undefined;
    },
    index: attribute(new Uint16Array([0, 1, 2]), 1)
  };
}

test('accepts a finite indexed triangle', () => {
  assert.equal(geometryValidationError(triangle()), null);
});

test('rejects non-finite vertex positions', () => {
  const geometry = triangle();
  geometry.getAttribute = (name) => name === 'position' ? attribute(new Float32Array([0, 0, 0, 1, 0, 0, NaN, 1, 0]), 3) : undefined;
  assert.match(geometryValidationError(geometry), /não finitas/);
});

test('rejects incomplete or out-of-range triangle indices', () => {
  const geometry = triangle();
  geometry.index = attribute(new Uint16Array([0, 1]), 1);
  assert.match(geometryValidationError(geometry), /triângulos completos/);
  geometry.index = attribute(new Uint16Array([0, 1, 3]), 1);
  assert.match(geometryValidationError(geometry), /fora dos limites/);
});

test('rejects mismatched paint and mask data', () => {
  const geometry = triangle();
  geometry.getAttribute = (name) => {
    if (name === 'position') return attribute(new Float32Array(9), 3);
    if (name === 'color') return attribute(new Float32Array(6), 3);
    return undefined;
  };
  assert.match(geometryValidationError(geometry), /atributo de cor/);
  geometry.getAttribute = (name) => name === 'position' ? attribute(new Float32Array(9), 3) : name === 'mask' ? attribute(new Float32Array([0, 0, 0.5, 0]), 1) : undefined;
  assert.match(geometryValidationError(geometry), /máscara não corresponde/);
});

test('rejects meshes above the configured vertex budget', () => {
  const geometry = triangle();
  assert.match(geometryValidationError(geometry, 2), /excede o limite/);
});

