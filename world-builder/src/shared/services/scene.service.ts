import {
  Injectable,
  NgZone,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { BehaviorSubject, Observable } from 'rxjs';

export interface RenderStats {
  fps: number;
  frameMs: number;
  drawCalls: number;
  triangles: number;
}

// Owns the renderer, camera, controls and lights. The terrain itself is
// built by TerrainMeshService.
@Injectable({ providedIn: 'root' })
export class SceneService implements OnDestroy {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private controls!: OrbitControls;
  private sun!: THREE.DirectionalLight;
  private animationId!: number;
  private isBrowser: boolean;
  private animationRunning = false;

  getScene(): THREE.Scene {
    return this.scene;
  }
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }
  getMaxAnisotropy(): number {
    return this.renderer?.capabilities.getMaxAnisotropy() ?? 1;
  }
  getCanvas(): HTMLCanvasElement {
    return this.renderer.domElement;
  }
  // Orbiting is paused while a transform gizmo is being dragged.
  setOrbitEnabled(enabled: boolean): void {
    this.controls.enabled = enabled;
  }
  // Background colour and fog, for saving a project.
  getSceneSettings(): { background: string; fog: { color: string; density: number } | null } {
    const background = this.scene.background instanceof THREE.Color ? this.scene.background : new THREE.Color(0x202020);
    const fog = this.scene.fog instanceof THREE.FogExp2 ? this.scene.fog : null;
    return {
      background: `#${background.getHexString()}`,
      fog: fog ? { color: `#${fog.color.getHexString()}`, density: fog.density } : null,
    };
  }

  applySceneSettings(settings: { background: string; fog: { color: string; density: number } | null }): void {
    this.scene.background = new THREE.Color(settings.background);
    this.scene.fog = settings.fog ? new THREE.FogExp2(settings.fog.color, settings.fog.density) : null;
    this._scene.next(this.scene);
  }

  // Performance figures, updated twice a second while enabled.
  private _stats = new BehaviorSubject<RenderStats | null>(null);
  stats$: Observable<RenderStats | null> = this._stats.asObservable();
  private statsEnabled = false;
  private statsWindow = { start: 0, frames: 0 };

  setStatsEnabled(enabled: boolean): void {
    this.statsEnabled = enabled;
    this.statsWindow = { start: performance.now(), frames: 0 };
    if (!enabled) this._stats.next(null);
  }

  private updateStats(): void {
    if (!this.statsEnabled) return;
    this.statsWindow.frames++;
    const elapsed = performance.now() - this.statsWindow.start;
    if (elapsed < 500) return;
    const info = this.renderer.info.render;
    const stats: RenderStats = {
      fps: Math.round((this.statsWindow.frames * 1000) / elapsed),
      frameMs: Math.round((elapsed / this.statsWindow.frames) * 10) / 10,
      drawCalls: info.calls,
      triangles: info.triangles,
    };
    this.statsWindow = { start: performance.now(), frames: 0 };
    this.ngZone.run(() => this._stats.next(stats));
  }

  // Runs `callback` before every rendered frame, outside Angular's zone.
  addFrameCallback(callback: () => void): void {
    this.frameCallbacks.push(callback);
  }

  private frameCallbacks: (() => void)[] = [];

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  private _scene = new BehaviorSubject<any>(null);

  // Public observable for components to subscribe to
  scene$: Observable<any> = this._scene.asObservable();

  init(container: HTMLElement): void {
    if (!this.isBrowser) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    this.renderer.setPixelRatio(window.devicePixelRatio);
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(this.renderer.domElement);

    this.scene = this._scene.getValue() || new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);

    // The camera orbits the scene, the scene itself stays still so object
    // positions remain in world coordinates.
    this.controls = new OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;
    this.controls.autoRotate = true;
    this.controls.autoRotateSpeed = 0.6;

    // Sky/ground fill plus one shadow-casting sun.
    const hemisphere = new THREE.HemisphereLight(0xdde8f5, 0x3d4a33, 1.2);
    this.scene.add(hemisphere);

    this.sun = new THREE.DirectionalLight(0xfff1dc, 2.4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(2048, 2048);
    this.sun.shadow.bias = -0.0005;
    this.sun.shadow.normalBias = 0.05;
    this.scene.add(this.sun);

    this.configureForWorld(30, 5);
    this.startAnimation();
    this._scene.next(this.scene);
  }

  // Frames the camera and fits the sun's shadow area to a terrain of the
  // given size. Called whenever the terrain's dimensions change.
  configureForWorld(worldSize: number, heightScale: number): void {
    if (!this.camera) return;

    this.camera.position.set(0, heightScale + worldSize * 0.45, worldSize * 0.85);
    this.camera.far = worldSize * 10;
    this.camera.updateProjectionMatrix();
    this.controls.target.set(0, heightScale * 0.3, 0);
    this.controls.maxDistance = worldSize * 3;
    this.controls.update();
    this.controls.saveState();

    this.sun.position.set(
      worldSize * 0.6,
      heightScale + worldSize * 0.8,
      worldSize * 0.35
    );
    const shadowCamera = this.sun.shadow.camera;
    const half = worldSize * 0.75;
    shadowCamera.left = -half;
    shadowCamera.right = half;
    shadowCamera.top = half;
    shadowCamera.bottom = -half;
    shadowCamera.near = 0.5;
    shadowCamera.far = worldSize * 3 + heightScale;
    shadowCamera.updateProjectionMatrix();
  }

  private startAnimation(): void {
    if (!this.isBrowser || this.animationRunning) return;
    this.animationRunning = true;

    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (!this.animationRunning) return;
        this.animationId = requestAnimationFrame(animate);
        this.controls.update();
        this.frameCallbacks.forEach((callback) => callback());
        this.renderer.render(this.scene, this.camera);
        this.updateStats();
      };
      animate();
    });
  }

  stopRotation(): void {
    this.controls.autoRotate = false;
  }

  startRotation(): void {
    this.controls.autoRotate = true;
  }

  // Restores the initial camera position and target (auto-rotate is kept as is).
  resetRotation(): void {
    this.controls.reset();
  }

  onResize(container: HTMLElement): void {
    if (!this.isBrowser) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height);
  }

  ngOnDestroy(): void {
    if (this.isBrowser && this.animationId) {
      cancelAnimationFrame(this.animationId);
    }
    this.animationRunning = false;
    this.controls?.dispose();
    if (this.isBrowser && this.renderer) {
      this.renderer.dispose();
    }
  }
}
