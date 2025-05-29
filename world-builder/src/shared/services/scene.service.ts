import {
  Injectable,
  NgZone,
  OnDestroy,
  Inject,
  PLATFORM_ID,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import * as THREE from 'three';
import { Position } from '../interfaces/position';

@Injectable({ providedIn: 'root' })
export class SceneService implements OnDestroy {
  private renderer!: THREE.WebGLRenderer;
  private scene!: THREE.Scene;
  private camera!: THREE.PerspectiveCamera;
  private animationId!: number;
  private terrain!: THREE.Mesh;
  private isBrowser: boolean;
  private sceneRotation = true;
  private animationRunning = false;

  getScene(): THREE.Scene {
    return this.scene;
  }
  getCamera(): THREE.PerspectiveCamera {
    return this.camera;
  }

  constructor(
    private ngZone: NgZone,
    @Inject(PLATFORM_ID) private platformId: Object
  ) {
    this.isBrowser = isPlatformBrowser(this.platformId);
  }

  getTerrain(): THREE.Mesh {
    if (!this.terrain) {
      console.warn('Terrain mesh not initialized yet.');
      return new THREE.Mesh();
    }
    return this.terrain;
  }

  addDisplacedPlane() {
    const width = 20;
    const height = 20;
    const widthSegments = 30;
    const heightSegments = 30;
    const geometry = new THREE.PlaneGeometry(
      width,
      height,
      widthSegments,
      heightSegments
    );

    const positionAttribute = geometry.attributes['position'];

    for (let i = 0; i < positionAttribute.count; i++) {
      const x = positionAttribute.getX(i);
      const y = positionAttribute.getY(i);
      const z = positionAttribute.getZ(i);

      const displacement = (Math.random() - 0.5) * 0.5;
      positionAttribute.setZ(i, z + displacement);
    }

    geometry.computeVertexNormals();

    const material = new THREE.MeshStandardMaterial({
      color: 'green',
      side: THREE.DoubleSide,
      flatShading: false,
      wireframe: false,
    });

    geometry.rotateX(-Math.PI / 2);
    const plane = new THREE.Mesh(geometry, material);
    this.scene.add(plane);
    this.terrain = plane;
  }

  init(container: HTMLElement): void {
    if (!this.isBrowser) return;

    const width = container.clientWidth;
    const height = container.clientHeight;

    this.renderer = new THREE.WebGLRenderer({ antialias: true });
    this.renderer.setSize(width, height);
    container.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x202020);

    this.camera = new THREE.PerspectiveCamera(60, width / height, 0.1, 3000);
    this.camera.position.z = 27;
    this.camera.position.y = 5;

    const lightOne = new THREE.DirectionalLight(0xffffff, 1);
    lightOne.castShadow = true;
    const lightTwo = new THREE.DirectionalLight(0xffffff, 1);
    // lightTwo.castShadow = true;
    const lightThree = new THREE.DirectionalLight(0xffffff, 1);
    // lightThree.castShadow = true;
    const lightFour = new THREE.DirectionalLight(0xffffff, 1);
    // lightFour.castShadow = true;

    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    lightOne.position.set(10, 10, 10);
    this.scene.add(lightOne);
    lightTwo.position.set(-10, 10, 10);
    this.scene.add(lightTwo);
    lightThree.position.set(10, -10, 10);
    this.scene.add(lightThree);
    lightFour.position.set(-10, -10, 10);
    this.scene.add(lightFour);

    const geometry = new THREE.BoxGeometry(20, 0.1, 20);
    const material = new THREE.MeshStandardMaterial({ color: 'blue' });
    // this.terrain = new THREE.Mesh(geometry, material);
    // this.scene.add(this.terrain);

    this.startAnimation();
    this.addDisplacedPlane();
  }

  private startAnimation(): void {
    if (!this.isBrowser || this.animationRunning) return;
    this.animationRunning = true;

    this.ngZone.runOutsideAngular(() => {
      const animate = () => {
        if (!this.animationRunning) return;
        this.animationId = requestAnimationFrame(animate);
        if (this.sceneRotation) {
          this.scene.rotation.y += 0.001;
        }
        this.renderer.render(this.scene, this.camera);
      };
      animate();
    });
  }

  stopRotation(): void {
    this.sceneRotation = false;
    this.startAnimation();
  }

  startRotation(): void {
    this.sceneRotation = true;
    this.startAnimation();
  }

  resetRotation(): void {
    this.scene.rotation.y = 0;
  }

  rotateScene(direction: string): void {
    if (direction === 'left') {
      this.scene.rotation.y -= 0.1;
    } else if (direction === 'right') {
      this.scene.rotation.y += 0.1;
    }
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
    if (this.isBrowser && this.renderer) {
      this.renderer.dispose();
    }
  }
}
