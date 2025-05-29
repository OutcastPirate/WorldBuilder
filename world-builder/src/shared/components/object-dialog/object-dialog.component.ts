import { Component } from '@angular/core';
import { Dialog } from '@angular/cdk/dialog';
import { DialogRef } from '@angular/cdk/dialog';
import { CommonModule } from '@angular/common';
import { OnInit } from '@angular/core';
import { ObjectsService } from '../../services/objects.service';

@Component({
  selector: 'app-object-dialog',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './object-dialog.component.html',
  styleUrl: './object-dialog.component.scss',
})
export class ObjectDialogComponent implements OnInit {
  constructor(
    private dialogRef: DialogRef,
    private objectService: ObjectsService
  ) {}

  ngOnInit(): void {
    this.loadAssets();
  }

  mode: string = 'Basic';

  chosenFormat: string = 'OBJ';

  setFormat(format: string): void {
    this.chosenFormat = format;
  }

  predefindedAssets: string[] = [];

  chosenFile: File | null = null;
  chosenMaterialFile: File | null = null;

  setMode(mode: string): void {
    this.mode = mode;
  }

  close(): void {
    this.dialogRef.close();
  }

  addBasicShape(shape: string): void {
    console.log(`Adding basic shape: ${shape}`);
  }

  chooseFile(): void {
    if (!this.chosenFile) {
      console.error('No file selected');
      return;
    }
    const fileName = this.chosenFile.name;
    const fileExtension = fileName.split('.').pop()?.toLowerCase();
    if (fileExtension !== 'obj' && fileExtension !== 'gltf') {
      console.error('Selected file is not an OBJ or GLTF file');
      return;
    }
    if (fileExtension === 'gltf') {
      this.objectService.addGLTF(this.chosenFile);
    } else if (fileExtension === 'obj') {
      if (this.chosenMaterialFile) {
        this.objectService.addOBJ(this.chosenFile, this.chosenMaterialFile);
      } else {
        this.objectService.addOBJ(this.chosenFile);
      }
    }
  }

  onFileSelected(event: any): void {
    const file: File = event.target.files && event.target.files[0];
    if (file) {
      this.chosenFile = file;
      const filePath = event.target.value || file.name;
    }
  }

  onMaterialFileSelected(event: any): void {
    const file: File = event.target.files && event.target.files[0];
    if (file) {
      this.chosenMaterialFile = file;
      const filePath = event.target.value || file.name;
    }
  }

  loadAssets(): void {}
}
