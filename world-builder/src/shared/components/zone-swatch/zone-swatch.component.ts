import { Component, ElementRef, Input, OnChanges, ViewChild } from '@angular/core';
import { ZoneMaterial } from '../../generation/config';
import { TexturingService } from '../../services/texturing.service';

// Small square showing a zone's texture tinted with its colour.
@Component({
  selector: 'app-zone-swatch',
  standalone: true,
  template: '<canvas #canvas width="48" height="48" aria-hidden="true"></canvas>',
  styles: [
    'canvas { display: block; width: 48px; height: 48px; border: 3px ridge gray; border-radius: 5px; }',
  ],
})
export class ZoneSwatchComponent implements OnChanges {
  @Input({ required: true }) zone!: ZoneMaterial;

  @ViewChild('canvas', { static: true })
  canvas!: ElementRef<HTMLCanvasElement>;

  constructor(private texturingService: TexturingService) {}

  ngOnChanges(): void {
    this.texturingService
      .renderSwatch(this.zone, this.canvas.nativeElement)
      .catch((error) => console.error(error));
  }
}
