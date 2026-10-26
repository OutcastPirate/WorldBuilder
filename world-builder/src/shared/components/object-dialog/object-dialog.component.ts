import { Component } from '@angular/core';
import { DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { OnInit } from '@angular/core';
import { ObjectsService } from '../../services/objects.service';
import { AssetLoaderService } from '../../services/asset-loader.service';
import { PredefinedAsset } from '../../interfaces/predefinedAsset';
import { FormsModule } from '@angular/forms';

const SUPPORTED_EXTENSIONS = ['obj', 'gltf', 'glb'];

@Component({
  selector: 'app-object-dialog',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './object-dialog.component.html',
  styleUrl: './object-dialog.component.scss',
})
export class ObjectDialogComponent implements OnInit {
  constructor(
    private dialogRef: DialogRef,
    private objectService: ObjectsService,
    private assetLoader: AssetLoaderService
  ) {}

  ngOnInit(): void {
    this.loadAssets();
  }

  mode: string = 'Basic';

  basicShape: any = {
    width: 1,
    height: 1,
    color: '#ffffff',
  };

  predefinedAssets: PredefinedAsset[] = [];
  loadingAsset: string | null = null;
  errorMessage: string | null = null;

  chosenFile: File | null = null;
  chosenMaterialFile: File | null = null;

  setMode(mode: string): void {
    this.mode = mode;
    this.errorMessage = null;
    this.chosenFile = null;
    this.chosenMaterialFile = null;
  }

  close(): void {
    this.dialogRef.close();
  }

  addBasicShape(shape: string, shapeData: any): void {
    switch (shape) {
      case 'Cube':
        this.objectService.addCube(
          shapeData.height,
          shapeData.width,
          shapeData.color
        );
        break;
      case 'Sphere':
        this.objectService.addSphere(
          shapeData.height,
          shapeData.width,
          shapeData.color
        );
        break;
      case 'Cylinder':
        this.objectService.addCylinder(
          shapeData.height,
          shapeData.width,
          shapeData.color
        );
        break;
      case 'Cone':
        this.objectService.addCone(
          shapeData.height,
          shapeData.width,
          shapeData.color
        );
        break;
      default:
        console.error(`Unknown shape: ${shape}`);
        break;
    }
    this.close();
  }

  async addPredefined(asset: PredefinedAsset): Promise<void> {
    this.loadingAsset = asset.name;
    await this.objectService.addPredefined(asset);
    this.loadingAsset = null;
    this.close();
  }

  async chooseFile(): Promise<void> {
    if (!this.chosenFile) {
      this.errorMessage = 'No file selected';
      return;
    }
    const fileExtension = this.chosenFile.name.split('.').pop()?.toLowerCase();
    if (!fileExtension || !SUPPORTED_EXTENSIONS.includes(fileExtension)) {
      this.errorMessage = 'Selected file is not an OBJ, GLTF or GLB file';
      return;
    }
    this.loadingAsset = this.chosenFile.name;
    await this.objectService.addFromFile(
      this.chosenFile,
      fileExtension === 'obj' ? this.chosenMaterialFile ?? undefined : undefined
    );
    this.loadingAsset = null;
    this.close();
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files && event.target.files[0];
    if (file) {
      this.chosenFile = file;
      this.errorMessage = null;
    }
  }

  onMaterialFileSelected(event: any): void {
    const file: File = event.target.files && event.target.files[0];
    if (file) {
      this.chosenMaterialFile = file;
    }
  }

  loadAssets(): void {
    this.assetLoader
      .loadPredefinedManifest()
      .then((assets) => (this.predefinedAssets = assets))
      .catch((error) => {
        console.error(error);
        this.errorMessage = 'Could not load the predefined asset list';
      });
  }
}
