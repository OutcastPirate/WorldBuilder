import { Component } from '@angular/core';
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

ObjectsService;

@Component({
  selector: 'app-objectsmenu',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './objectsmenu.component.html',
  styleUrl: './objectsmenu.component.scss',
})
export class ObjectsmenuComponent {
  constructor(private objectsService: ObjectsService, private dialog: Dialog) {}
  objects: AssetInstance[] = [];
  detailsVisible: boolean[] = [];
  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = this.objectsService.objects$.subscribe(
      (objects) => (this.objects = objects)
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
  }

  snapObjectDownwardProto(object: any) {
    this.objectsService.snapDownPrototype(object);
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
