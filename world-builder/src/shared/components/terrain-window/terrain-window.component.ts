import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  HostListener,
} from '@angular/core';
import { SceneService } from '../../services/scene.service';
import { TerrainMeshService } from '../../services/terrain-mesh.service';
import { TexturingService } from '../../services/texturing.service';
import { PlacementLayerService } from '../../services/placement-layer.service';
import { SelectionService } from '../../services/selection.service';
import { SelectionBarComponent } from '../selection-bar/selection-bar.component';
import { AsyncPipe, NgIf } from '@angular/common';

@Component({
  selector: 'app-terrain-window',
  templateUrl: './terrain-window.component.html',
  styleUrls: ['./terrain-window.component.scss'],
  standalone: true,
  imports: [SelectionBarComponent, NgIf, AsyncPipe],
})
export class TerrainWindowComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true })
  rendererContainer!: ElementRef;

  constructor(
    public terrainRenderer: SceneService,
    private terrainMesh: TerrainMeshService,
    private texturing: TexturingService,
    private placementLayer: PlacementLayerService,
    private selection: SelectionService
  ) {}

  ngAfterViewInit(): void {
    this.terrainRenderer.init(this.rendererContainer.nativeElement);
    this.texturing.start();
    this.placementLayer.start();
    this.selection.start();
    this.terrainMesh.generate();
  }

  @HostListener('window:resize')
  onResize(): void {
    this.terrainRenderer.onResize(this.rendererContainer.nativeElement);
  }

  ngOnDestroy(): void {
    this.terrainRenderer.ngOnDestroy();
  }

  stopRotation(): void {
    this.terrainRenderer.stopRotation();
  }

  startRotation(): void {
    this.terrainRenderer.startRotation();
  }

  resetScene(): void {
    this.terrainRenderer.resetRotation();
  }
}
