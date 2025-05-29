import {
  Component,
  ElementRef,
  AfterViewInit,
  OnDestroy,
  ViewChild,
  HostListener,
} from '@angular/core';
import { SceneService } from '../../services/scene.service';

@Component({
  selector: 'app-terrain-window',
  templateUrl: './terrain-window.component.html',
  styleUrls: ['./terrain-window.component.scss'],
  standalone: true,
})
export class TerrainWindowComponent implements AfterViewInit, OnDestroy {
  @ViewChild('rendererContainer', { static: true })
  rendererContainer!: ElementRef;

  constructor(private terrainRenderer: SceneService) {}

  ngAfterViewInit(): void {
    this.terrainRenderer.init(this.rendererContainer.nativeElement);
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
