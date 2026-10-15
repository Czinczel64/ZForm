export function geometryValidationError(geometry, maxVertices = 120000) {
  const position = geometry?.getAttribute?.('position');
  if (!position || position.itemSize !== 3 || !Number.isInteger(position.count) || position.count < 3 || position.array?.length !== position.count * 3) {
    return 'A malha precisa ter pelo menos três posições XYZ válidas.';
  }
  if (position.count > maxVertices) return `A malha excede o limite de ${maxVertices.toLocaleString('pt-BR')} vértices.`;
  for (const value of position.array) if (!Number.isFinite(value)) return 'A malha contém posições não finitas.';

  const index = geometry.index;
  if (index) {
    if (index.itemSize !== 1 || index.count < 3 || index.count % 3 !== 0 || index.array?.length !== index.count) {
      return 'A lista de índices precisa formar triângulos completos.';
    }
    for (const value of index.array) {
      if (!Number.isInteger(value) || value < 0 || value >= position.count) return 'A malha contém índices fora dos limites.';
    }
  } else if (position.count % 3 !== 0) {
    return 'Uma malha sem índices precisa ter vértices em grupos de três.';
  }

  for (const [name, itemSize] of [['color', 3], ['mask', 1]]) {
    const attribute = geometry.getAttribute(name);
    if (!attribute) continue;
    if (attribute.itemSize !== itemSize || attribute.count !== position.count || attribute.array?.length !== position.count * itemSize) {
      return `O atributo ${name === 'color' ? 'de cor' : 'de máscara'} não corresponde aos vértices.`;
    }
    for (const value of attribute.array) {
      if (!Number.isFinite(value)) return `O atributo ${name === 'color' ? 'de cor' : 'de máscara'} contém valores inválidos.`;
      if (name === 'mask' && (value < 0 || value > 1)) return 'A máscara precisa estar entre 0 e 1.';
    }
  }
  return null;
}

export function assertValidGeometry(geometry, maxVertices = 120000) {
  const error = geometryValidationError(geometry, maxVertices);
  if (error) throw new Error(error);
  return geometry;
}

