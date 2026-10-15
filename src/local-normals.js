export function buildVertexFaceIndex(geometry) {
  const position = geometry.getAttribute('position');
  const indices = geometry.index?.array || null;
  const indexCount = indices?.length ?? position.count;
  const faceCount = indexCount / 3;
  const counts = new Uint32Array(position.count);
  const faceVertex = (face, corner) => indices ? indices[face * 3 + corner] : face * 3 + corner;

  for (let face = 0; face < faceCount; face++) {
    counts[faceVertex(face, 0)]++;
    counts[faceVertex(face, 1)]++;
    counts[faceVertex(face, 2)]++;
  }
  const offsets = new Uint32Array(position.count + 1);
  for (let vertex = 0; vertex < position.count; vertex++) offsets[vertex + 1] = offsets[vertex] + counts[vertex];
  const incidentFaces = new Uint32Array(offsets[position.count]);
  const cursor = offsets.slice(0, position.count);
  for (let face = 0; face < faceCount; face++) {
    incidentFaces[cursor[faceVertex(face, 0)]++] = face;
    incidentFaces[cursor[faceVertex(face, 1)]++] = face;
    incidentFaces[cursor[faceVertex(face, 2)]++] = face;
  }
  return { offsets, incidentFaces, faceCount, faceVertex };
}

export function updateVertexNormalsLocally(geometry, changedVertices, topology = buildVertexFaceIndex(geometry)) {
  if (!changedVertices.length) return [];
  const position = geometry.getAttribute('position');
  const normal = geometry.getAttribute('normal');
  if (!normal) return [];
  const affectedFaces = new Set();
  for (const vertex of changedVertices) {
    for (let i = topology.offsets[vertex]; i < topology.offsets[vertex + 1]; i++) affectedFaces.add(topology.incidentFaces[i]);
  }
  const affectedVertices = new Set();
  for (const face of affectedFaces) {
    affectedVertices.add(topology.faceVertex(face, 0));
    affectedVertices.add(topology.faceVertex(face, 1));
    affectedVertices.add(topology.faceVertex(face, 2));
  }

  for (const vertex of affectedVertices) {
    let nx = 0, ny = 0, nz = 0;
    for (let i = topology.offsets[vertex]; i < topology.offsets[vertex + 1]; i++) {
      const face = topology.incidentFaces[i];
      const a = topology.faceVertex(face, 0), b = topology.faceVertex(face, 1), c = topology.faceVertex(face, 2);
      const abx = position.getX(b) - position.getX(a), aby = position.getY(b) - position.getY(a), abz = position.getZ(b) - position.getZ(a);
      const acx = position.getX(c) - position.getX(a), acy = position.getY(c) - position.getY(a), acz = position.getZ(c) - position.getZ(a);
      nx += aby * acz - abz * acy;
      ny += abz * acx - abx * acz;
      nz += abx * acy - aby * acx;
    }
    const length = Math.hypot(nx, ny, nz);
    if (length > 0) { nx /= length; ny /= length; nz /= length; }
    normal.setXYZ(vertex, nx, ny, nz);
  }
  return [...affectedVertices];
}

