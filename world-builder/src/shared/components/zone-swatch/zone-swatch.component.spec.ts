import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ZoneSwatchComponent } from './zone-swatch.component';
import { DEFAULT_TEXTURING_CONFIG } from '../../generation/config';

describe('ZoneSwatchComponent', () => {
  let component: ZoneSwatchComponent;
  let fixture: ComponentFixture<ZoneSwatchComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ZoneSwatchComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ZoneSwatchComponent);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('zone', DEFAULT_TEXTURING_CONFIG.zones[0]);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
