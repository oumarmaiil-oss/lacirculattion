import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

export function detectSoftwareGl(): boolean {
  try {
    const c = document.createElement('canvas');
    const gl =
      (c.getContext('webgl2') as WebGL2RenderingContext | null) ||
      (c.getContext('webgl') as WebGLRenderingContext | null);
    if (!gl) return true;
    const ext = gl.getExtension('WEBGL_debug_renderer_info');
    if (ext) {
      const r = String(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) || '');
      if (/SwiftShader|llvmpipe|softpipe/i.test(r)) return true;
    }
    return false;
  } catch {
    return true;
  }
}

export function afterDraw(gl: WebGLRenderingContext | WebGL2RenderingContext): void {
  if ('fenceSync' in gl && typeof gl.fenceSync === 'function') {
    const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
    if (sync) {
      gl.flush();
      gl.clientWaitSync(sync, 0, 50_000_000);
      gl.deleteSync(sync);
      return;
    }
  }
  gl.finish();
}

export function createTissueBumpTexture(): THREE.CanvasTexture {
  const cv = document.createElement('canvas');
  cv.width = 128;
  cv.height = 128;
  const ctx = cv.getContext('2d')!;
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, 128, 128);
  for (let i = 0; i < 420; i++) {
    const x = (i * 73) % 128;
    const y = (i * 41) % 128;
    const w = 14 + (i % 18);
    const h = 2 + (i % 3);
    const v = 104 + ((i * 29) % 48);
    ctx.fillStyle = `rgb(${v},${v},${v})`;
    ctx.fillRect(x, y, w, h);
  }
  const tex = new THREE.CanvasTexture(cv);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(3, 3);
  return tex;
}

export function makeTextSprite(text: string, color = '#e2e8f0'): THREE.Sprite {
  const cv = document.createElement('canvas');
  const ctx = cv.getContext('2d')!;
  ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
  const metrics = ctx.measureText(text);
  const padX = 12;
  const w = Math.ceil(metrics.width + padX * 2);
  const h = 32;
  cv.width = w;
  cv.height = h;

  ctx.font = '600 18px "Plus Jakarta Sans", system-ui, sans-serif';
  ctx.fillStyle = 'rgba(7, 11, 20, 0.82)';
  ctx.strokeStyle = 'rgba(148, 163, 184, 0.28)';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.roundRect(1, 1, w - 2, h - 2, 8);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, w / 2, h / 2 + 1);

  const tex = new THREE.CanvasTexture(cv);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthTest: false,
    depthWrite: false,
  });
  const sp = new THREE.Sprite(mat);
  const scale = 0.0056;
  sp.scale.set(w * scale, h * scale, 1);
  sp.renderOrder = 10;
  return sp;
}

export interface ThreeViewport {
  scene: THREE.Scene;
  camera: THREE.PerspectiveCamera;
  renderer: THREE.WebGLRenderer;
  controls: OrbitControls;
  root: THREE.Group;
  labelsGroup: THREE.Group;
  clipPlane: THREE.Plane;
  clipActive: boolean;
  isSoftwareGl: boolean;
  needRender: boolean;
  pickTargets: THREE.Object3D[];
  setView: (pos: [number, number, number], target: [number, number, number]) => void;
  setClip: (active: boolean) => void;
  renderNow: () => void;
  dispose: () => void;
}

export interface Make3DOptions {
  container: HTMLElement;
  camPos: [number, number, number];
  target: [number, number, number];
  onPick?: (id: string | null) => void;
  onHover?: (id: string | null, clientX: number, clientY: number) => void;
}

export function make3D({
  container,
  camPos,
  target,
  onPick,
  onHover,
}: Make3DOptions): ThreeViewport {
  const isSoftwareGl = detectSoftwareGl();
  const w = Math.max(320, container.clientWidth || 640);
  const h = Math.max(240, container.clientHeight || 480);

  const renderer = new THREE.WebGLRenderer({
    antialias: !isSoftwareGl,
    alpha: true,
    preserveDrawingBuffer: true,
    powerPreference: 'high-performance',
  });
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
  renderer.localClippingEnabled = true;
  renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(2, window.devicePixelRatio || 1));
  renderer.setSize(w, h);
  renderer.domElement.style.width = '100%';
  renderer.domElement.style.height = '100%';
  renderer.domElement.style.display = 'block';
  container.innerHTML = '';
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environment = envTex;
  scene.environmentIntensity = 0.55;

  const hemi = new THREE.HemisphereLight(0xdbeafe, 0x1e293b, 0.85);
  scene.add(hemi);
  const keyLight = new THREE.DirectionalLight(0xfff1e6, 2.0);
  keyLight.position.set(4.5, 6.2, 5.5);
  scene.add(keyLight);
  const rimLight = new THREE.DirectionalLight(0x7dd3fc, 0.95);
  rimLight.position.set(-5.0, -2.0, -4.5);
  scene.add(rimLight);

  const camera = new THREE.PerspectiveCamera(38, w / h, 0.1, 80);
  camera.position.set(...camPos);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(...target);
  controls.enableDamping = !isSoftwareGl;
  controls.dampingFactor = 0.08;
  controls.minDistance = 2.6;
  controls.maxDistance = 12;
  controls.update();

  const root = new THREE.Group();
  const labelsGroup = new THREE.Group();
  scene.add(root);
  scene.add(labelsGroup);

  const clipPlane = new THREE.Plane(new THREE.Vector3(0, 0, -1), 0.18);
  const pickTargets: THREE.Object3D[] = [];

  const viewport: ThreeViewport = {
    scene,
    camera,
    renderer,
    controls,
    root,
    labelsGroup,
    clipPlane,
    clipActive: false,
    isSoftwareGl,
    needRender: true,
    pickTargets,
    setView(pos, tgt) {
      camera.position.set(...pos);
      controls.target.set(...tgt);
      controls.update();
      viewport.needRender = true;
    },
    setClip(active) {
      viewport.clipActive = active;
      viewport.needRender = true;
    },
    renderNow() {
      controls.update();
      renderer.render(scene, camera);
      viewport.needRender = false;
    },
    dispose() {
      if (resizeRaf) cancelAnimationFrame(resizeRaf);
      ro.disconnect();
      dom.removeEventListener('pointerdown', onPointerDown);
      dom.removeEventListener('pointerup', onPointerUp);
      dom.removeEventListener('pointermove', onPointerMove);
      dom.removeEventListener('webglcontextlost', onContextLost);
      dom.removeEventListener('webglcontextrestored', onContextRestored);
      controls.dispose();
      scene.traverse((obj) => {
        if ((obj as THREE.Mesh).isMesh || (obj as THREE.Sprite).isSprite) {
          const m = obj as THREE.Mesh;
          if (m.geometry) m.geometry.dispose();
          const mats = Array.isArray(m.material) ? m.material : [m.material];
          mats.forEach((mat) => {
            if (!mat) return;
            const mm = mat as THREE.MeshStandardMaterial;
            if (mm.map) mm.map.dispose();
            if (mm.bumpMap) mm.bumpMap.dispose();
            mat.dispose();
          });
        }
      });
      envTex.dispose();
      pmrem.dispose();
      renderer.dispose();
      if (renderer.domElement.parentElement === container) {
        container.removeChild(renderer.domElement);
      }
    },
  };

  controls.addEventListener('change', () => {
    viewport.needRender = true;
  });

  let lastW = w;
  let lastH = h;
  let resizeRaf = 0;
  const ro = new ResizeObserver(() => {
    if (resizeRaf) cancelAnimationFrame(resizeRaf);
    resizeRaf = requestAnimationFrame(() => {
      resizeRaf = 0;
      const nw = Math.max(240, container.clientWidth);
      const nh = Math.max(200, container.clientHeight);
      if (nw === lastW && nh === lastH) return;
      lastW = nw;
      lastH = nh;
      camera.aspect = nw / nh;
      camera.updateProjectionMatrix();
      renderer.setSize(nw, nh, false);
      viewport.needRender = true;
    });
  });
  ro.observe(container);

  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  let downX = 0;
  let downY = 0;

  const isObjVisible = (obj: THREE.Object3D): boolean => {
    let cur: THREE.Object3D | null = obj;
    while (cur) {
      if (!cur.visible) return false;
      cur = cur.parent;
    }
    return true;
  };

  const raycastAt = (clientX: number, clientY: number): string | null => {
    if (!pickTargets.length) return null;
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.x = ((clientX - rect.left) / rect.width) * 2 - 1;
    ptr.y = -((clientY - rect.top) / rect.height) * 2 + 1;
    ray.setFromCamera(ptr, camera);
    const hits = ray.intersectObjects(pickTargets, true);
    for (const hit of hits) {
      if (!isObjVisible(hit.object)) continue;
      if (viewport.clipActive) {
        const clipped = (hit.object as THREE.Mesh).material;
        const arr = Array.isArray(clipped) ? clipped : [clipped];
        if (arr.some((m) => m && m.clippingPlanes && m.clippingPlanes.length > 0)) {
          if (clipPlane.distanceToPoint(hit.point) < -0.01) continue;
        }
      }
      let cur: THREE.Object3D | null = hit.object;
      while (cur) {
        if (cur.userData && typeof cur.userData.pickId === 'string') {
          return cur.userData.pickId;
        }
        cur = cur.parent;
      }
    }
    return null;
  };

  const dom = renderer.domElement;
  const onPointerDown = (e: PointerEvent) => {
    downX = e.clientX;
    downY = e.clientY;
  };
  const onPointerUp = (e: PointerEvent) => {
    if (Math.hypot(e.clientX - downX, e.clientY - downY) > 6) return;
    if (onPick) onPick(raycastAt(e.clientX, e.clientY));
  };
  const onPointerMove = (e: PointerEvent) => {
    if (!onHover) return;
    onHover(raycastAt(e.clientX, e.clientY), e.clientX, e.clientY);
  };
  const onContextLost = (e: Event) => {
    e.preventDefault();
  };
  const onContextRestored = () => {
    viewport.needRender = true;
  };

  dom.addEventListener('pointerdown', onPointerDown);
  dom.addEventListener('pointerup', onPointerUp);
  dom.addEventListener('pointermove', onPointerMove);
  dom.addEventListener('webglcontextlost', onContextLost);
  dom.addEventListener('webglcontextrestored', onContextRestored);

  return viewport;
}
