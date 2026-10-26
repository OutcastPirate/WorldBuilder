import { ComponentFixture, TestBed } from '@angular/core/testing';

import { HeightmapPreviewComponent } from './heightmap-preview.component';
import { DEFAULT_TERRAIN_CONFIG, DEFAULT_TEXTURING_CONFIG } from '../../generation/config';

describe('HeightmapPreviewComponent', () => {
  let component: HeightmapPreviewComponent;
  let fixture: ComponentFixture<HeightmapPreviewComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [HeightmapPreviewComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(HeightmapPreviewComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('config', { ...DEFAULT_TERRAIN_CONFIG, resolution: 129 });
    fixture.componentRef.setInput('texturing', DEFAULT_TEXTURING_CONFIG);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
