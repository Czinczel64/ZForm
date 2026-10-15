import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { OBJLoader } from 'three/addons/loaders/OBJLoader.js';
import { STLLoader } from 'three/addons/loaders/STLLoader.js';
import { OBJExporter } from 'three/addons/exporters/OBJExporter.js';
import { STLExporter } from 'three/addons/exporters/STLExporter.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js';
import { mergeVertices } from 'three/addons/utils/BufferGeometryUtils.js';
import './style.css';

const $ = (selector) => document.querySelector(selector);
const viewport = $('#viewport');
const toast = $('#toast');
const toolNames = { draw: 'Desenhar', smooth: 'Suavizar', move: 'Mover', inflate: 'Inflar', flatten: 'Achatar', clay: 'Argila', crease: 'Vinco', pinch: 'Pinçar', mask: 'Máscara', unmask: 'Remover máscara', paint: 'Pincel', erase: 'Borracha' };
const tips = [
  ['Dica rápida', 'Faça pinceladas leves em várias passadas para construir volume com controle.'],
  ['Navegue pela forma', 'Segure Alt e arraste com o botão esquerdo para orbitar. Use a roda para aproximar ou afastar.'],
  ['Trabalhe em simetria', 'A simetria X ajuda a manter os dois lados da forma equilibrados.'],
  ['Volte quando quiser', 'Use Ctrl+Z para desfazer uma pincelada e Ctrl+Shift+Z para refazê-la.']
];
const guideSteps = [
  ['Escolha uma ferramenta', 'Comece com Desenhar. Use os números para trocar de ferramenta e M para pintar uma máscara.', 'Desenhar volume', '1'],
  ['Ajuste o pincel', 'No painel Propriedades, ajuste tamanho e intensidade. Comece com movimentos leves e aumente aos poucos.', 'Tamanho e intensidade', 'Painel à direita'],
  ['Modele a forma', 'Arraste o botão esquerdo sobre o modelo para esculpir. Segure Alt enquanto arrasta para orbitar; a roda controla o zoom.', 'Faça algumas passadas', 'Botão esquerdo'],
  ['Pinte seu modelo', 'Escolha Pincel na barra lateral, selecione uma cor e arraste sobre a forma. A simetria X está ligada por padrão.', 'Pincel de pintura', '6'],
  ['Salve e exporte', 'O estudo é salvo neste dispositivo automaticamente. Use Exportar para gerar um OBJ, STL ou GLB.', 'Exportar modelo', 'OBJ / STL / GLB']
];

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
renderer.setSize(viewport.clientWidth, viewport.clientHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
renderer.domElement.className = 'scene-canvas';
viewport.prepend(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color('#17191b');
const camera = new THREE.PerspectiveCamera(38, viewport.clientWidth / viewport.clientHeight, 0.1, 100);
camera.position.set(0.1, 0.15, 5.5);
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.08;
// Sculpting owns the left mouse button; hold Alt to temporarily orbit instead.
controls.mouseButtons.LEFT = null;
controls.mouseButtons.RIGHT = THREE.MOUSE.PAN;
controls.listenToKeyEvents(window);
controls.keys = { LEFT: 'ArrowLeft', RIGHT: 'ArrowRight', UP: 'ArrowUp', BOTTOM: 'ArrowDown' };
controls.keyPanSpeed = 0;
const orbitAlt = { isKeyDown: false };
window.addEventListener('keydown', (event) => {
  if (event.key === 'Alt' && !orbitAlt.isKeyDown) {
    orbitAlt.isKeyDown = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.enabled = true;
  }
});
window.addEventListener('keyup', (event) => {
  if (event.key === 'Alt') {
    orbitAlt.isKeyDown = false;
    controls.mouseButtons.LEFT = null;
    controls.enabled = true;
  }
});
window.addEventListener('blur', () => { orbitAlt.isKeyDown = false; controls.mouseButtons.LEFT = null; controls.enabled = true; });
controls.target.set(0, 0, 0);
controls.minDistance = 2.2;
controls.maxDistance = 12;

scene.add(new THREE.HemisphereLight('#f2e8da', '#30363b', 2.1));
const keyLight = new THREE.DirectionalLight('#ffe2c9', 3.8); keyLight.position.set(-3, 5, 5); scene.add(keyLight);
const fillLight = new THREE.DirectionalLight('#9fb9d2', 2.5); fillLight.position.set(4, 1, -4); scene.add(fillLight);
const rimLight = new THREE.DirectionalLight('#e1ad87', 1.4); rimLight.position.set(0, -4, -2); scene.add(rimLight);

const grid = new THREE.GridHelper(20, 40, '#414345', '#292c2e');
grid.position.y = -1.45;
grid.material.transparent = true;
grid.material.opacity = 0.28;
scene.add(grid);
const ground = new THREE.Mesh(new THREE.CircleGeometry(8, 64), new THREE.MeshBasicMaterial({ color: '#17191b' }));
ground.rotation.x = -Math.PI / 2; ground.position.y = -1.46; scene.add(ground);

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
const brushRing = $('#brush-cursor');
const history = [];
const redoStack = [];
const dbPromise = openDB();
let mesh = null;
let activeTool = 'draw';
let activeMaterial = 'clay';
let isPainting = false;
let lastDab = 0;
let strokeSnapshot = null;
let saveTimer = null;
let currentTip = 0;
let guideIndex = -1;
let showWireframe = false;
let symmetry = true;
const neighborCache = new WeakMap();

const matOptions = {
  clay: { roughness: 0.78, metalness: 0.02 }, matte: { roughness: 1, metalness: 0 },
  metal: { roughness: 0.27, metalness: 0.78 }, soft: { roughness: 0.45, metalness: 0.04 }
};

function openDB() {
  return new Promise((resolve) => {
    const request = indexedDB.open('zform-projects', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('documents');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function setToast(message) {
  toast.textContent = message;
  toast.classList.add('visible');
  clearTimeout(setToast.timer);
  setToast.timer = setTimeout(() => toast.classList.remove('visible'), 2200);
}

function setGeometry(geometry, name = 'Estudo sem título') {
  if (mesh) { scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose(); }
  // Imported or restored scenes must never inherit the wireframe/transparent display state.
  showWireframe = false;
  $('#wire-toggle').classList.remove('selected');
  geometry.computeVertexNormals();
  if (!geometry.getAttribute('color')) {
    const count = geometry.getAttribute('position').count;
    const colors = new Float32Array(count * 3);
    const base = new THREE.Color($('#color-control').value);
    for (let i = 0; i < count; i++) base.toArray(colors, i * 3);
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }
  if (!geometry.getAttribute('mask')) geometry.setAttribute('mask', new THREE.Float32BufferAttribute(new Float32Array(geometry.getAttribute('position').count), 1));
  const material = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: matOptions[activeMaterial].roughness, metalness: matOptions[activeMaterial].metalness, transparent: false, opacity: 1, depthWrite: true, side: THREE.DoubleSide });
  mesh = new THREE.Mesh(geometry, material);
  mesh.material.wireframe = false;
  mesh.name = name;
  scene.add(mesh);
  mesh.geometry.computeBoundingSphere();
  frameModel();
  updateGeometryInfo();
  $('#project-title').textContent = name;
  history.length = 0; redoStack.length = 0;
  queueSave();
}

function makeStarter() {
  const geometry = new THREE.SphereGeometry(1, 64, 48);
  const p = geometry.getAttribute('position');
  for (let i = 0; i < p.count; i++) {
    const v = new THREE.Vector3().fromBufferAttribute(p, i);
    const variation = 1 + 0.025 * Math.sin(v.x * 8) * Math.cos(v.y * 6) * Math.sin(v.z * 7);
    v.multiplyScalar(variation); p.setXYZ(i, v.x, v.y, v.z);
  }
  geometry.computeVertexNormals();
  setGeometry(geometry);
}

function frameModel() {
  if (!mesh) return;
  const box = new THREE.Box3().setFromObject(mesh);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z, 1) * 1.7;
  controls.target.copy(center);
  camera.position.set(center.x + radius * 0.06, center.y + radius * 0.08, center.z + radius * 2.8);
  controls.update();
}

function updateGeometryInfo() {
  if (!mesh) return;
  const position = mesh.geometry.getAttribute('position');
  const count = position.count;
  const faces = Math.round((mesh.geometry.index?.count ?? count) / 3);
  $('#polygon-count').textContent = faces.toLocaleString('pt-BR');
  $('#mesh-info').textContent = `${count.toLocaleString('pt-BR')} vértices · ${faces.toLocaleString('pt-BR')} faces`;
  $('#resolution-label').textContent = count > 100000 ? 'Muito alta' : count > 30000 ? 'Alta' : count > 8000 ? 'Média' : 'Baixa';
}

function snapshotGeometry() {
  if (!mesh) return null;
  const p = mesh.geometry.getAttribute('position');
  const c = mesh.geometry.getAttribute('color');
  const m = mesh.geometry.getAttribute('mask');
  return { positions: new Float32Array(p.array), colors: new Float32Array(c.array), mask: new Float32Array(m?.array || p.count) };
}

function restoreSnapshot(snapshot) {
  if (!mesh || !snapshot) return;
  const geometry = mesh.geometry;
  geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(snapshot.positions), 3));
  geometry.setAttribute('color', new THREE.BufferAttribute(new Float32Array(snapshot.colors), 3));
  if (snapshot.mask) geometry.setAttribute('mask', new THREE.BufferAttribute(new Float32Array(snapshot.mask), 1));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  updateGeometryInfo(); queueSave();
}

function pushHistory() {
  const snap = snapshotGeometry();
  if (!snap) return;
  history.push(snap);
  if (history.length > 20) history.shift();
  redoStack.length = 0;
}

function undo() {
  if (!history.length || !mesh) return;
  redoStack.push(snapshotGeometry());
  restoreSnapshot(history.pop());
  setToast('Ação desfeita');
}

function redo() {
  if (!redoStack.length || !mesh) return;
  history.push(snapshotGeometry());
  restoreSnapshot(redoStack.pop());
  setToast('Ação refeita');
}

function queueSave() {
  $('#saved-label').textContent = 'Salvando…';
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveLocal, 500);
}

async function saveLocal() {
  if (!mesh) return;
  const db = await dbPromise;
  if (!db) { $('#saved-label').textContent = 'Sessão atual'; return; }
  const p = mesh.geometry.getAttribute('position');
  const c = mesh.geometry.getAttribute('color');
  const data = { name: mesh.name, positions: Array.from(p.array), colors: Array.from(c.array), mask: Array.from(mesh.geometry.getAttribute('mask').array), material: activeMaterial, savedAt: Date.now() };
  const tx = db.transaction('documents', 'readwrite');
  tx.objectStore('documents').put(data, 'current');
  tx.oncomplete = () => { $('#saved-label').textContent = 'Salvo localmente'; };
  tx.onerror = () => { $('#saved-label').textContent = 'Falha ao salvar'; };
}

async function loadLocal() {
  const db = await dbPromise;
  if (!db) return false;
  return new Promise((resolve) => {
    const req = db.transaction('documents').objectStore('documents').get('current');
    req.onsuccess = () => {
      const data = req.result;
      if (!data?.positions?.length) return resolve(false);
      if (matOptions[data.material]) activeMaterial = data.material;
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
      if (data.colors) geometry.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
      if (data.mask) geometry.setAttribute('mask', new THREE.Float32BufferAttribute(data.mask, 1));
      geometry.computeVertexNormals();
      setGeometry(geometry, data.name || 'Estudo sem título');
      mesh.material.roughness = matOptions[activeMaterial].roughness;
      mesh.material.metalness = matOptions[activeMaterial].metalness;
      document.querySelectorAll('.material-card').forEach((button) => button.classList.toggle('selected', button.dataset.material === activeMaterial));
      resolve(true);
    };
    req.onerror = () => resolve(false);
  });
}

function setTool(tool) {
  activeTool = tool;
  document.querySelectorAll('.tool[data-tool]').forEach((button) => button.classList.toggle('active', button.dataset.tool === tool));
  $('#tool-title').textContent = toolNames[tool];
  const painting = tool === 'paint' || tool === 'erase';
  $('#strength-control').disabled = tool === 'smooth';
  brushRing.classList.toggle('painting', painting);
  renderer.domElement.style.cursor = 'none';
}

function pointerToNDC(event) {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
}

function rayHit(event) {
  if (!mesh) return null;
  pointerToNDC(event);
  raycaster.setFromCamera(pointer, camera);
  return raycaster.intersectObject(mesh, false)[0] || null;
}

function dab(event) {
  if (!mesh) return;
  const hit = rayHit(event);
  if (!hit) return;
  const geometry = mesh.geometry;
  const position = geometry.getAttribute('position');
  const colors = geometry.getAttribute('color');
  const mask = geometry.getAttribute('mask');
  const center = hit.point;
  const normal = hit.face.normal.clone().transformDirection(mesh.matrixWorld).normalize();
  const size = Number($('#size-control').value) / 160;
  const strength = Number($('#strength-control').value) / 100;
  const radius = Math.max(size, 0.025);
  const brushColor = new THREE.Color(activeTool === 'erase' ? '#c57a62' : $('#color-control').value);
  const localCenter = mesh.worldToLocal(center.clone());
  const normalLocal = normal.clone().transformDirection(mesh.matrixWorld.clone().invert()).normalize();
  const directions = symmetry ? [localCenter, new THREE.Vector3(-localCenter.x, localCenter.y, localCenter.z)] : [localCenter];
  const neighbors = activeTool === 'smooth' ? getVertexNeighbors(geometry) : null;
  let touched = false;
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
    let best = Infinity;
    for (const c of directions) best = Math.min(best, vertex.distanceTo(c));
    if (best > radius) continue;
    const falloff = (1 - best / radius) ** 2;
    const maskAmount = mask?.getX(i) ?? 0;
    if (activeTool === 'mask' || activeTool === 'unmask') {
      const target = activeTool === 'mask' ? 1 : 0;
      mask.setX(i, THREE.MathUtils.lerp(maskAmount, target, Math.min(1, strength * falloff * 0.8)));
      touched = true;
      continue;
    }
    const protection = 1 - maskAmount;
    if (protection <= 0.001) continue;
    if (activeTool === 'paint' || activeTool === 'erase') {
      const current = new THREE.Color().fromBufferAttribute(colors, i);
      const amount = Math.min(0.92, strength * falloff * 0.72 * protection);
      current.lerp(brushColor, amount);
      colors.setXYZ(i, current.r, current.g, current.b);
    } else if (activeTool === 'smooth') {
      const adjacent = neighbors[i];
      if (!adjacent?.length) continue;
      const average = new THREE.Vector3();
      for (const j of adjacent) average.add(new THREE.Vector3().fromBufferAttribute(position, j));
      average.multiplyScalar(1 / adjacent.length);
      const original = new THREE.Vector3().fromBufferAttribute(position, i);
      const softened = original.lerp(average, Math.min(0.45, strength * falloff * 0.55 * protection));
      position.setXYZ(i, softened.x, softened.y, softened.z);
    } else {
      let amount = strength * falloff * 0.032 * protection;
      if (activeTool === 'move') amount = strength * falloff * 0.055 * protection;
      if (activeTool === 'crease') amount *= -1.1;
      if (activeTool === 'pinch') {
        const inward = localCenter.clone().sub(vertex).normalize();
        vertex.addScaledVector(inward, strength * falloff * 0.035 * protection);
        position.setXYZ(i, vertex.x, vertex.y, vertex.z); touched = true; continue;
      }
      if (activeTool === 'clay') amount *= 0.72;
      if (activeTool === 'flatten') {
        const distance = vertex.clone().sub(localCenter).dot(normalLocal);
        const adjusted = vertex.clone().addScaledVector(normalLocal, -distance * strength * falloff * 0.45 * protection);
        position.setXYZ(i, adjusted.x, adjusted.y, adjusted.z); touched = true; continue;
      }
      const direction = activeTool === 'move' || activeTool === 'draw' || activeTool === 'clay' || activeTool === 'crease' ? normalLocal : vertex.clone().normalize();
      const delta = (activeTool === 'draw' ? 1 : 1) * amount;
      vertex.addScaledVector(direction, delta);
      position.setXYZ(i, vertex.x, vertex.y, vertex.z);
    }
    touched = true;
  }
  if (touched) {
    position.needsUpdate = true; colors.needsUpdate = true;
    mask.needsUpdate = true;
    geometry.computeVertexNormals(); geometry.computeBoundingSphere();
    if (performance.now() - lastDab > 180) { updateGeometryInfo(); lastDab = performance.now(); }
  }
}

function getVertexNeighbors(geometry) {
  if (neighborCache.has(geometry)) return neighborCache.get(geometry);
  const p = geometry.getAttribute('position');
  const links = Array.from({ length: p.count }, () => new Set());
  const index = geometry.index?.array;
  const count = index ? index.length : p.count;
  for (let i = 0; i < count; i += 3) {
    const a = index ? index[i] : i, b = index ? index[i + 1] : i + 1, c = index ? index[i + 2] : i + 2;
    links[a].add(b); links[a].add(c); links[b].add(a); links[b].add(c); links[c].add(a); links[c].add(b);
  }
  const result = links.map((set) => [...set]);
  neighborCache.set(geometry, result);
  return result;
}

function beginStroke(event) {
  if (event.altKey) {
    endStroke();
    return;
  }
  if (event.button !== 0 || !['draw','smooth','move','inflate','flatten','clay','crease','pinch','mask','unmask','paint','erase'].includes(activeTool)) return;
  if (event.target !== renderer.domElement) return;
  event.preventDefault();
  isPainting = true;
  strokeSnapshot = snapshotGeometry();
  if (strokeSnapshot) { history.push(strokeSnapshot); if (history.length > 20) history.shift(); }
  redoStack.length = 0;
  renderer.domElement.setPointerCapture?.(event.pointerId);
  dab(event);
}

function endStroke() {
  if (!isPainting) return;
  isPainting = false;
  if (strokeSnapshot) queueSave();
  strokeSnapshot = null;
}

function normalizeGeometry(geometry) {
  geometry.deleteAttribute('normal');
  geometry = mergeVertices(geometry);
  const box = new THREE.Box3().setFromBufferAttribute(geometry.getAttribute('position'));
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const scale = 2 / Math.max(size.x, size.y, size.z, 0.001);
  geometry.translate(-center.x, -center.y, -center.z);
  geometry.scale(scale, scale, scale);
  return geometry;
}

async function importFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  try {
    let geometry;
    if (ext === 'obj') {
      const root = new OBJLoader().parse(await file.text());
      root.traverse((object) => { if (!geometry && object.isMesh) geometry = object.geometry.clone(); });
    } else if (ext === 'stl') {
      geometry = new STLLoader().parse(await file.arrayBuffer());
    } else if (ext === 'glb' || ext === 'gltf') {
      const loader = new GLTFLoader();
      const source = ext === 'glb' ? await file.arrayBuffer() : await file.text();
      const gltf = await new Promise((resolve, reject) => loader.parse(source, '', resolve, reject));
      gltf.scene.traverse((object) => { if (!geometry && object.isMesh) geometry = object.geometry.clone(); });
    } else {
      setToast('Formato não suportado. Use OBJ, STL ou GLB.'); return;
    }
    if (!geometry) { setToast('Não encontrei uma malha no arquivo.'); return; }
    if (geometry.getAttribute('position').count > 120000) {
      setToast('A malha excede o limite de 120 mil vértices deste MVP.'); return;
    }
    geometry = normalizeGeometry(geometry);
    setGeometry(geometry, file.name.replace(/\.[^.]+$/, ''));
    setToast('Modelo importado');
  } catch (error) {
    console.error(error); setToast('Não foi possível abrir esse arquivo.');
  }
}

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportFile(format) {
  if (!mesh) return;
  const name = (mesh.name || 'forma').replace(/[^\p{L}\p{N}_-]+/gu, '-');
  if (format === 'obj') {
    const text = new OBJExporter().parse(mesh);
    downloadBlob(new Blob([text], { type: 'text/plain' }), `${name}.obj`);
  } else if (format === 'glb') {
    new GLTFExporter().parse(mesh, (data) => {
      downloadBlob(new Blob([data], { type: 'model/gltf-binary' }), `${name}.glb`);
      $('#export-popover').classList.add('hidden'); setToast('Arquivo GLB exportado');
    }, (error) => { console.error(error); setToast('Não foi possível exportar GLB.'); }, { binary: true });
    return;
  } else {
    const data = new STLExporter().parse(mesh, { binary: true });
    downloadBlob(new Blob([data], { type: 'model/stl' }), `${name}.stl`);
  }
  $('#export-popover').classList.add('hidden');
  setToast(`Arquivo ${format.toUpperCase()} exportado`);
}

function refineMesh() {
  if (!mesh) return;
  const old = mesh.geometry;
  const oldPosition = old.getAttribute('position');
  const faceCount = (old.index?.count ?? oldPosition.count) / 3;
  if (oldPosition.count + faceCount * 3 > 120000) { setToast('A malha já está no limite de refinamento do MVP.'); return; }
  pushHistory();
  const refined = new THREE.BufferGeometry();
  const p = old.getAttribute('position'); const c = old.getAttribute('color'); const mask = old.getAttribute('mask');
  const positions = Array.from(p.array); const colors = Array.from(c.array); const masks = Array.from(mask?.array || new Float32Array(p.count)); const indices = [];
  const edgeCache = new Map();
  const midpoint = (a,b) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (edgeCache.has(key)) return edgeCache.get(key);
    const va = new THREE.Vector3().fromBufferAttribute(p,a), vb = new THREE.Vector3().fromBufferAttribute(p,b);
    const ca = new THREE.Color().fromBufferAttribute(c,a), cb = new THREE.Color().fromBufferAttribute(c,b);
    const id = positions.length / 3, vm = va.add(vb).multiplyScalar(.5), cm = ca.lerp(cb,.5);
    positions.push(vm.x,vm.y,vm.z); colors.push(cm.r,cm.g,cm.b); masks.push(mask ? (mask.getX(a) + mask.getX(b)) / 2 : 0); edgeCache.set(key,id); return id;
  };
  const source = old.index?.array || Array.from({length:p.count},(_,i)=>i);
  for (let i = 0; i < source.length; i += 3) {
    const a=source[i], b=source[i+1], d=source[i+2], ab=midpoint(a,b), bd=midpoint(b,d), da=midpoint(d,a);
    indices.push(a,ab,da, ab,b,bd, da,bd,d, ab,bd,da);
  }
  refined.setAttribute('position', new THREE.Float32BufferAttribute(positions,3));
  refined.setAttribute('color', new THREE.Float32BufferAttribute(colors,3));
  refined.setAttribute('mask', new THREE.Float32BufferAttribute(masks,1));
  refined.setIndex(indices);
  refined.computeVertexNormals();
  mesh.geometry = refined; old.dispose(); updateGeometryInfo(); queueSave(); setToast('Malha refinada');
}

function resize() {
  const width = viewport.clientWidth; const height = viewport.clientHeight;
  renderer.setSize(width,height); camera.aspect = width/height; camera.updateProjectionMatrix();
}

function animate() {
  requestAnimationFrame(animate);
  if (mesh) {
    mesh.material.transparent = false;
    mesh.material.opacity = 1;
    mesh.material.depthWrite = true;
    mesh.material.wireframe = showWireframe;
  }
  controls.update();
  renderer.render(scene,camera);
}

renderer.domElement.addEventListener('pointerdown', beginStroke);
renderer.domElement.addEventListener('pointerdown', (event) => {
  if (event.altKey && event.button === 0) {
    controls.enabled = true;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
  }
});
renderer.domElement.addEventListener('pointermove', (event) => {
  const rect = viewport.getBoundingClientRect();
  brushRing.style.left = `${event.clientX - rect.left}px`; brushRing.style.top = `${event.clientY - rect.top}px`;
  brushRing.style.width = `${Number($('#size-control').value)}px`; brushRing.style.height = `${Number($('#size-control').value)}px`;
  brushRing.classList.toggle('visible', event.clientX >= rect.left && event.clientX <= rect.right && event.clientY >= rect.top && event.clientY <= rect.bottom);
  if (isPainting && event.buttons & 1) dab(event);
});
renderer.domElement.addEventListener('pointerup', endStroke);
renderer.domElement.addEventListener('pointercancel', endStroke);
renderer.domElement.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('pointerup', endStroke);
window.addEventListener('resize', resize);

document.querySelectorAll('.tool[data-tool]').forEach((button) => button.addEventListener('click', () => setTool(button.dataset.tool)));
$('#size-control').addEventListener('input', (event) => { $('#size-value').textContent = event.target.value; brushRing.style.width = `${event.target.value}px`; brushRing.style.height = `${event.target.value}px`; });
$('#strength-control').addEventListener('input', (event) => { $('#strength-value').textContent = `${event.target.value}%`; });
$('#color-control').addEventListener('input', (event) => { $('#color-hex').textContent = event.target.value.toUpperCase(); });
document.querySelectorAll('[data-color]').forEach((button) => button.addEventListener('click', () => { $('#color-control').value = button.dataset.color; $('#color-hex').textContent = button.dataset.color.toUpperCase(); }));
document.querySelectorAll('.material-card').forEach((button) => button.addEventListener('click', () => {
  activeMaterial = button.dataset.material;
  document.querySelectorAll('.material-card').forEach((b) => b.classList.toggle('selected', b === button));
  if (mesh) { mesh.material.roughness = matOptions[activeMaterial].roughness; mesh.material.metalness = matOptions[activeMaterial].metalness; }
  queueSave();
}));
$('#undo-button').addEventListener('click', undo); $('#redo-button').addEventListener('click', redo);
$('#fill-color-button').addEventListener('click', () => {
  if (!mesh) return;
  pushHistory(); const colors = mesh.geometry.getAttribute('color'); const color = new THREE.Color($('#color-control').value);
  for (let i = 0; i < colors.count; i++) colors.setXYZ(i, color.r, color.g, color.b);
  colors.needsUpdate = true; queueSave(); setToast('Cor aplicada à malha');
});
$('#clear-mask-button').addEventListener('click', () => {
  if (!mesh) return;
  pushHistory(); const mask = mesh.geometry.getAttribute('mask'); mask.array.fill(0); mask.needsUpdate = true; queueSave(); setToast('Máscara removida');
});
$('#subdivide-button').addEventListener('click', refineMesh); $('#home-view').addEventListener('click', frameModel); $('#fit-model').addEventListener('click', frameModel);
$('#wire-toggle').addEventListener('click', () => { showWireframe = !showWireframe; if (mesh) mesh.material.wireframe = showWireframe; $('#wire-toggle').classList.toggle('selected',showWireframe); });
$('#grid-toggle').addEventListener('click', () => { grid.visible = !grid.visible; $('#grid-toggle').classList.toggle('selected',grid.visible); });
$('#fullscreen').addEventListener('click', () => document.fullscreenElement ? document.exitFullscreen() : viewport.requestFullscreen?.());
$('#symmetry-toggle').addEventListener('click', (event) => { symmetry = !symmetry; event.currentTarget.classList.toggle('active',symmetry); $('#symmetry-label').textContent = symmetry ? 'Simetria X' : 'Simetria desligada'; });
$('#file-input').addEventListener('change', (event) => { if (event.target.files[0]) importFile(event.target.files[0]); event.target.value = ''; });
$('#open-file-button').addEventListener('click', () => $('#file-input').click());
viewport.addEventListener('dragover', (event) => { event.preventDefault(); $('#drop-overlay').classList.add('show'); });
viewport.addEventListener('dragleave', (event) => { if (!viewport.contains(event.relatedTarget)) $('#drop-overlay').classList.remove('show'); });
viewport.addEventListener('drop', (event) => { event.preventDefault(); $('#drop-overlay').classList.remove('show'); const file = event.dataTransfer.files[0]; if (file) importFile(file); });
$('#export-menu-button').addEventListener('click', (event) => { const pop = $('#export-popover'); pop.classList.toggle('hidden'); const rect = event.currentTarget.getBoundingClientRect(); pop.style.top = `${rect.bottom + 8}px`; pop.style.right = `${Math.max(12, window.innerWidth - rect.right)}px`; });
document.querySelectorAll('[data-export]').forEach((button) => button.addEventListener('click', () => exportFile(button.dataset.export)));
document.addEventListener('click', (event) => { if (!event.target.closest('#export-menu-button') && !event.target.closest('#export-popover')) $('#export-popover').classList.add('hidden'); });
function openHelp() {
  guideIndex = -1;
  $('#help-eyebrow').textContent = 'COMECE EM 1 MINUTO';
  $('#help-title').textContent = 'Conheça o ZForm';
  $('#help-text').textContent = 'Este guia mostra o fluxo básico para esculpir, pintar e salvar seu primeiro estudo.';
  $('#guide-content').innerHTML = '<div><span>Desenhar volume</span><kbd>1</kbd></div><div><span>Suavizar</span><kbd>2</kbd></div><div><span>Mover</span><kbd>3</kbd></div><div><span>Inflar / achatar</span><kbd>4 / 5</kbd></div><div><span>Pintar / borracha</span><kbd>6 / 7</kbd></div><div><span>Desfazer</span><kbd>Ctrl + Z</kbd></div><div><span>Importar arquivo</span><kbd>Arraste para a tela</kbd></div>';
  $('#start-help').textContent = 'Começar guia';
  $('#help-modal').classList.remove('hidden');
}
function showGuideStep() {
  const [title, text, action, key] = guideSteps[guideIndex];
  $('#help-eyebrow').textContent = `PASSO ${guideIndex + 1} DE ${guideSteps.length}`;
  $('#help-title').textContent = title;
  $('#help-text').textContent = text;
  $('#guide-content').innerHTML = `<div><span>${action}</span><kbd>${key}</kbd></div>`;
  $('#start-help').textContent = guideIndex === guideSteps.length - 1 ? 'Concluir guia' : 'Próximo passo →';
  if (guideIndex === 3) setTool('paint');
}
$('#help-button').addEventListener('click', openHelp); $('#bottom-help').addEventListener('click', openHelp);
$('#close-help').addEventListener('click', () => $('#help-modal').classList.add('hidden'));
$('#skip-tour').addEventListener('click', () => $('#help-modal').classList.add('hidden'));
$('#start-help').addEventListener('click', () => {
  if (guideIndex < 0) guideIndex = 0;
  else guideIndex += 1;
  if (guideIndex >= guideSteps.length) { $('#help-modal').classList.add('hidden'); setToast('Guia concluído. Bom trabalho!'); return; }
  showGuideStep();
});
$('#next-tip').addEventListener('click', () => { currentTip = (currentTip + 1) % tips.length; $('#tip-title').textContent = tips[currentTip][0]; $('#tip-text').textContent = tips[currentTip][1]; });
$('#close-tip').addEventListener('click', () => $('.learning-card').classList.add('dismissed'));
$('#palette-toggle').addEventListener('click', () => $('#swatches').classList.toggle('open'));
$('#geometry-menu').addEventListener('click', () => setToast('A resolução acompanha a densidade da malha.'));
document.addEventListener('keydown', (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) return;
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') { event.preventDefault(); event.shiftKey ? redo() : undo(); return; }
  const keyTools = { '1':'draw','2':'smooth','3':'move','4':'inflate','5':'flatten','6':'paint','7':'erase','8':'clay','9':'crease','0':'pinch','m':event.shiftKey ? 'unmask' : 'mask' };
  if (keyTools[event.key]) setTool(keyTools[event.key]);
  if (event.key === '?') $('#help-modal').classList.remove('hidden');
  if (event.key === 'Escape') { $('#help-modal').classList.add('hidden'); $('#export-popover').classList.add('hidden'); }
  if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'o') { event.preventDefault(); $('#file-input').click(); }
});

$('#file-input').addEventListener('click', () => {});
$('#project-title').addEventListener('dblclick', () => {
  const name = prompt('Nome do estudo', mesh?.name || 'Estudo sem título');
  if (name?.trim() && mesh) { mesh.name = name.trim(); $('#project-title').textContent = mesh.name; queueSave(); }
});

makeStarter();
loadLocal().then((restored) => { if (restored) setToast('Projeto local restaurado'); });
animate();
if ('serviceWorker' in navigator && import.meta.env.PROD) navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
