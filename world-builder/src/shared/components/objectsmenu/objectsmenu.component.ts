import { Component, ElementRef } from '@angular/core';
import { ObjectsService } from '../../services/objects.service';
import { CommonModule } from '@angular/common';
import { Subscription } from 'rxjs';
import * as THREE from 'three';
import { OnInit } from '@angular/core';
import { OnDestroy } from '@angular/core';
import { AssetInstance } from '../../interfaces/assetInstance';
import { FormsModule } from '@angular/forms';
import { isMesh, isMaterialWithColor } from '../../interfaces/material_guard';
import { ObjectDialogComponent } from '../object-dialog/object-dialog.component';
import { Dialog } from '@angular/cdk/dialog';
import { SelectionService } from '../../services/selection.service';

ObjectsService;

@Component({
  selector: 'app-objectsmenu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './objectsmenu.component.html',
  styleUrl: './objectsmenu.component.scss',
})
export class ObjectsmenuComponent {
  constructor(
    private objectsService: ObjectsService,
    private dialog: Dialog,
    private selectionService: SelectionService,
    private host: ElementRef<HTMLElement>
  ) {}
  objects: AssetInstance[] = [];
  detailsVisible: boolean[] = [];
  // Object selected in the 3D view, if it is one of these.
  selected: AssetInstance | null = null;
  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = this.objectsService.objects$.subscribe(
      (objects) => (this.objects = objects)
    );
    this.subscription.add(
      this.selectionService.selection$.subscribe((selection) => {
        this.selected = selection?.kind === 'manual' ? selection.instance : null;
        // Bring the selected card into view once it has re-rendered.
        setTimeout(() =>
          this.host.nativeElement
            .querySelector('.object.selected')
            ?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
        );
      })
    );
    if (this.objects.length > 0) {
      this.objects.forEach(() => {
        this.detailsVisible.push(false);
      });
    }
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }

  openObjectDialog() {
    this.dialog.open<string>(ObjectDialogComponent);
  }

  addCube(
    height: number,
    width: number,
    color: string,
    position: { x: number; y: number; z: number }
  ): void {
    this.objectsService.addCube(height, width, color, position);
  }

  getObjectColor(object: THREE.Object3D): string {
    if (!isMesh(object)) return '#ffffff';

    if (Array.isArray(object.material)) {
      const firstMat = object.material[0];
      return isMaterialWithColor(firstMat)
        ? `#${firstMat.color.getHexString()}`
        : '#ffffff';
    }

    return isMaterialWithColor(object.material)
      ? `#${object.material.color.getHexString()}`
      : '#ffffff';
  }

  changeScale(object: AssetInstance, value: number): void {
    object.object.scale.x = value;
    object.object.scale.y = value;
    object.object.scale.z = value;
    object.object.updateMatrix();
  }

  snapObjectDownward(object: any) {
    this.objectsService.snapDown(object);
    this.objectsService.notifyChanged();
  }

  select(object: AssetInstance): void {
    this.selectionService.select({ kind: 'manual', instance: object });
  }

  // Position or size edited in the form: let automatic placement react.
  notifyChanged(): void {
    this.objectsService.notifyChanged();
  }

  // X or Z typed in: objects that stick to the ground follow its height.
  positionChanged(object: AssetInstance): void {
    if (object.snapToGround) this.objectsService.snapDown(object.object);
    this.objectsService.notifyChanged();
  }

  setSnapToGround(object: AssetInstance, snap: boolean): void {
    this.selectionService.setSnapToGround(object, snap);
  }

  setObjectColor(object: THREE.Object3D, event: Event): void {
    if (!isMesh(object)) return;

    const color = (event.target as HTMLInputElement).value;

    if (Array.isArray(object.material)) {
      object.material.forEach((mat) => {
        if (isMaterialWithColor(mat)) {
          mat.color.set(color);
          mat.needsUpdate = true;
        }
      });
    } else if (isMaterialWithColor(object.material)) {
      object.material.color.set(color);
      object.material.needsUpdate = true;
    }
  }

  // addObject(url: string): void {
  //   console.log(url);
  //   this.objectsService.addOBJ(url);
  // }

  deleteObject(object: AssetInstance): void {
    const index = this.objects.findIndex((o) => o === object);
    if (index !== -1) {
      this.detailsVisible.splice(index, 1);
    }
    this.objectsService.removeObject(object);
  }
}
