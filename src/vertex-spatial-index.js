export class VertexSpatialIndex {
  constructor(position, cellSize = 0.2) {
    if (!(cellSize > 0)) throw new RangeError('cellSize precisa ser positivo.');
    this.position = position;
    this.cellSize = cellSize;
    this.cells = new Map();
    this.vertexKeys = new Array(position.count);
    for (let i = 0; i < position.count; i++) this.#insert(i, position.getX(i), position.getY(i), position.getZ(i));
  }

  #key(x, y, z) {
    const size = this.cellSize;
    return `${Math.floor(x / size)},${Math.floor(y / size)},${Math.floor(z / size)}`;
  }

  #insert(index, x, y, z) {
    const key = this.#key(x, y, z);
    let cell = this.cells.get(key);
    if (!cell) this.cells.set(key, cell = []);
    cell.push(index);
    this.vertexKeys[index] = key;
  }

  querySphere(center, radius) {
    const size = this.cellSize;
    const minX = Math.floor((center.x - radius) / size), maxX = Math.floor((center.x + radius) / size);
    const minY = Math.floor((center.y - radius) / size), maxY = Math.floor((center.y + radius) / size);
    const minZ = Math.floor((center.z - radius) / size), maxZ = Math.floor((center.z + radius) / size);
    const radiusSquared = radius * radius;
    const result = [];
    for (let x = minX; x <= maxX; x++) for (let y = minY; y <= maxY; y++) for (let z = minZ; z <= maxZ; z++) {
      const cell = this.cells.get(`${x},${y},${z}`);
      if (!cell) continue;
      for (const index of cell) {
        const dx = this.position.getX(index) - center.x;
        const dy = this.position.getY(index) - center.y;
        const dz = this.position.getZ(index) - center.z;
        if (dx * dx + dy * dy + dz * dz <= radiusSquared) result.push(index);
      }
    }
    return result;
  }

  updateVertex(index, newX, newY, newZ) {
    const oldKey = this.vertexKeys[index];
    const newKey = this.#key(newX, newY, newZ);
    if (oldKey === newKey) return;
    const oldCell = this.cells.get(oldKey);
    const oldOffset = oldCell.indexOf(index);
    if (oldOffset !== -1) oldCell.splice(oldOffset, 1);
    if (!oldCell.length) this.cells.delete(oldKey);
    this.#insert(index, newX, newY, newZ);
  }
}

