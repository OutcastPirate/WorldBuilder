import { Injectable, NgZone } from '@angular/core';
import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { BehaviorSubject, Observable } from 'rxjs';
import { PlacedObject } from '../generation/placement';
import { AssetInstance } from '../interfaces/assetInstance';
import { AssetLibraryService } from './asset-library.service';
import { ObjectsService } from './objects.service';
import { PlacementLayerService } from './placement-layer.service';
import { SceneService } from './scene.service';
import { TerrainMeshService } from './terrain-mesh.service';

export type Selection =
  | { kind: 'manual'; instance: AssetInstance }
  | { kind: 'generated'; object: PlacedObject };

export type TransformMode = 'translate' | 'rotate';

// A press that moves further than this is an orbit drag, not a click.
const CLICK_TOLERANCE_PX = 5;
const HIGHLIGHT_COLOR = 0xffd54a;

// Editing in the 3D view (section 4.1, stage 4): click to select, Delete to
// remove, a gizmo to move (along the ground) or rotate hand-placed objects,
// and a place mode that adds a library model wherever the terrain is clicked.
@Injectable({
  providedIn: 'root',
})
export class SelectionService {
  constructor(
    private ngZone: NgZone,
    private sceneService: SceneService,
    private objectsService: ObjectsService,
    private placementLayer: PlacementLayerService,
    private terrainMesh: TerrainMeshService,
    private library: AssetLibraryService
  ) {}

  private _selection = new BehaviorSubject<Selection | null>(null);
  private _placingAssetId = new BehaviorSubject<string | null>(null);
  private _mode = new BehaviorSubject<TransformMode>('translate');

  selection$: Observable<Selection | null> = this._selection.asObservable();
  placingAssetId$: Observable<string | null> = this._placingAssetId.asObservable();
  mode$: Observable<TransformMode> = this._mode.asObservable();

  private started = false;
  private transform!: TransformControls;
  private highlight = new THREE.Box3Helper(new THREE.Box3(), HIGHLIGHT_COLOR);
  private marker!: THREE.Mesh;
  private raycaster = new THREE.Raycaster();
  private pressedAt: { x: number; y: number } | null = null;

  get selection(): Selection | null {
    return this._selection.getValue();
  }

  start(): void {
    if (this.started) return;
    this.started = true;
    const scene = this.sceneService.getScene();
    const canvas = this.sceneService.getCanvas();

    this.transform = new TransformControls(this.sceneService.getCamera(), canvas);
    this.transform.setSize(0.8);
    this.transform.addEventListener('dragging-changed', (event) => {
      const dragging = Boolean(event.value);
      this.sceneService.setOrbitEnabled(!dragging);
      // Let automatic placement react once, when the drag ends.
      if (!dragging) this.ngZone.run(() => this.objectsService.notifyChanged());
    });
    this.transform.addEventListener('objectChange', () => {
      const selection = this.selection;
      if (
        selection?.kind === 'manual' &&
        selection.instance.snapToGround &&
        this._mode.getValue() === 'translate'
      ) {
        this.objectsService.snapDown(selection.instance.object);
      }
    });
    scene.add(this.transform.getHelper());

    this.highlight.visible = false;
    scene.add(this.highlight);

    // Ring showing where (and how big) a model will be placed.
    const ring = new THREE.RingGeometry(0.85, 1, 48);
    ring.rotateX(-Math.PI / 2);
    this.marker = new THREE.Mesh(
      ring,
      new THREE.MeshBasicMaterial({ color: HIGHLIGHT_COLOR, transparent: true, opacity: 0.9, depthTest: false })
    );
    this.marker.renderOrder = 999;
    this.marker.visible = false;
    scene.add(this.marker);

    // Pointer moves fire constantly; keep them out of Angular's change detection.
    this.ngZone.runOutsideAngular(() => {
      canvas.addEventListener('pointerdown', (e) => this.onPointerDown(e));
      canvas.addEventListener('pointerup', (e) => this.onPointerUp(e));
      canvas.addEventListener('pointermove', (e) => this.onPointerMove(e));
      window.addEventListener('keydown', (e) => this.onKeyDown(e));
    });
    this.sceneService.addFrameCallback(() => this.updateHighlight());

    // Drop the selection when its object disappears.
    this.objectsService.objects$.subscribe((objects) => {
      const selection = this.selection;
      if (selection?.kind === 'manual' && !objects.includes(selection.instance)) this.clear();
    });
    this.placementLayer.summary$.subscribe(() => {
      const selection = this.selection;
      if (
        selection?.kind === 'generated' &&
        this.placementLayer.getObject(selection.object.id) !== selection.object
      ) {
        this.clear();
      }
    });
  }

  select(selection: Selection | null): void {
    this._selection.next(selection);
    if (selection?.kind === 'manual') {
      this.transform.attach(selection.instance.object);
      this.applyMode();
    } else {
      this.transform.detach();
    }
  }

  clear(): void {
    this.select(null);
  }

  setMode(mode: TransformMode): void {
    this._mode.next(mode);
    this.applyMode();
  }

  deleteSelection(): void {
    const selection = this.selection;
    if (!selection) return;
    this.clear();
    if (selection.kind === 'manual') this.objectsService.removeObject(selection.instance);
    else this.placementLayer.remove(selection.object.id);
  }

  // Turns the selected generated object into a hand-placed one, which can
  // be moved and rotated and survives regeneration.
  async makeEditable(): Promise<void> {
    const selection = this.selection;
    if (selection?.kind !== 'generated') return;
    const { object } = selection;
    const matrix = this.placementLayer.getMatrix(object.id);
    if (!matrix) return;
    const position = new THREE.Vector3().setFromMatrixPosition(matrix);
    this.placementLayer.remove(object.id);
    const instance = await this.objectsService.addLibraryObject(
      object.assetId,
      position,
      object.rotationY,
      object.scale
    );
    if (instance) this.select({ kind: 'manual', instance });
  }

  // Turns ground snapping on or off for a hand-placed object. Turning it on
  // drops the object onto the ground right away.
  setSnapToGround(instance: AssetInstance, snap: boolean): void {
    instance.snapToGround = snap;
    if (snap) {
      this.objectsService.snapDown(instance.object);
      this.objectsService.notifyChanged();
    }
    if (this.selection?.kind === 'manual' && this.selection.instance === instance) {
      this.applyMode();
      this._selection.next(this.selection);
    }
  }

  async startPlacing(assetId: string): Promise<void> {
    this.clear();
    this._placingAssetId.next(assetId);
    this.sceneService.getCanvas().style.cursor = 'crosshair';
    try {
      const prototype = await this.library.getPrototype(assetId);
      this.marker.scale.setScalar(Math.max(prototype.footprintRadius, 0.3));
    } catch (error) {
      console.error(error);
      this.stopPlacing();
    }
  }

  stopPlacing(): void {
    this._placingAssetId.next(null);
    this.marker.visible = false;
    this.sceneService.getCanvas().style.cursor = '';
  }

  // Name and description of the current selection, for the UI.
  describe(selection: Selection): { name: string; detail: string } {
    if (selection.kind === 'manual') {
      return { name: selection.instance.name, detail: 'hand-placed' };
    }
    const asset = this.library.find(selection.object.assetId);
    return { name: asset?.name ?? selection.object.assetId, detail: `generated ${selection.object.categoryId}` };
  }

  private applyMode(): void {
    const mode = this._mode.getValue();
    const selection = this.selection;
    const snap = selection?.kind === 'manual' && selection.instance.snapToGround;
    this.transform.setMode(mode);
    // Moving: along the ground only while the object sticks to it, freely
    // (with a vertical arrow) otherwise. Rotating: around the vertical axis.
    this.transform.showX = mode === 'translate';
    this.transform.showZ = mode === 'translate';
    this.transform.showY = mode === 'rotate' || !snap;
  }

  private onPointerDown(event: PointerEvent): void {
    // Presses on the gizmo belong to the gizmo.
    this.pressedAt = this.transform.axis ? null : { x: event.clientX, y: event.clientY };
  }

  private onPointerUp(event: PointerEvent): void {
    const pressedAt = this.pressedAt;
    this.pressedAt = null;
    if (!pressedAt || event.button !== 0) return;
    const moved = Math.hypot(event.clientX - pressedAt.x, event.clientY - pressedAt.y);
    if (moved > CLICK_TOLERANCE_PX) return;
    this.ngZone.run(() => this.onClick(event));
  }

  private onPointerMove(event: PointerEvent): void {
    if (!this._placingAssetId.getValue()) return;
    const point = this.terrainMesh.intersectRay(this.rayFrom(event));
    this.marker.visible = !!point;
    if (point) this.marker.position.set(point.x, point.y + 0.05, point.z);
  }

  private onClick(event: PointerEvent): void {
    const ray = this.rayFrom(event);
    const terrainPoint = this.terrainMesh.intersectRay(ray);

    const placing = this._placingAssetId.getValue();
    if (placing) {
      if (terrainPoint) {
        this.objectsService.addLibraryObject(placing, terrainPoint, Math.random() * Math.PI * 2);
      }
      return;
    }

    const manual = this.objectsService.objects;
    const hit = this.raycaster.intersectObjects(
      [...manual.map((o) => o.object), ...this.placementLayer.getMeshes()],
      true
    )[0];
    // Objects hidden behind a hill can't be clicked.
    const terrainDistance = terrainPoint ? terrainPoint.distanceTo(ray.origin) : Infinity;
    if (!hit || hit.distance > terrainDistance + 0.01) {
      this.clear();
      return;
    }

    if (hit.object instanceof THREE.InstancedMesh && hit.instanceId !== undefined) {
      const object = this.placementLayer.objectAt(hit.object, hit.instanceId);
      this.select(object ? { kind: 'generated', object } : null);
      return;
    }
    const instance = manual.find((o) => isAncestor(o.object, hit.object));
    this.select(instance ? { kind: 'manual', instance } : null);
  }

  private onKeyDown(event: KeyboardEvent): void {
    // Don't steal keys from form fields.
    const target = event.target as HTMLElement | null;
    if (target && (/^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName) || target.isContentEditable)) return;

    const handled = this.ngZone.run(() => {
      switch (event.key) {
        case 'Escape':
          if (this._placingAssetId.getValue()) this.stopPlacing();
          else this.clear();
          return true;
        case 'Delete':
        case 'Backspace':
          if (!this.selection) return false;
          this.deleteSelection();
          return true;
        case 'w':
        case 'W':
          if (this.selection?.kind !== 'manual') return false;
          this.setMode('translate');
          return true;
        case 'e':
        case 'E':
          if (this.selection?.kind !== 'manual') return false;
          this.setMode('rotate');
          return true;
        case 'g':
        case 'G': {
          const selection = this.selection;
          if (selection?.kind !== 'manual') return false;
          this.setSnapToGround(selection.instance, !selection.instance.snapToGround);
          return true;
        }
        default:
          return false;
      }
    });
    if (handled) event.preventDefault();
  }

  private rayFrom(event: PointerEvent): THREE.Ray {
    const rect = this.sceneService.getCanvas().getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );
    this.raycaster.setFromCamera(ndc, this.sceneService.getCamera());
    return this.raycaster.ray;
  }

  private updateHighlight(): void {
    const selection = this.selection;
    let box: THREE.Box3 | undefined;
    if (selection?.kind === 'manual') {
      box = new THREE.Box3().setFromObject(selection.instance.object);
    } else if (selection?.kind === 'generated') {
      box = this.placementLayer.boundingBox(selection.object.id);
    }
    this.highlight.visible = !!box && !box.isEmpty();
    if (box) this.highlight.box.copy(box);
  }
}

function isAncestor(ancestor: THREE.Object3D, object: THREE.Object3D): boolean {
  for (let o: THREE.Object3D | null = object; o; o = o.parent) {
    if (o === ancestor) return true;
  }
  return false;
}
