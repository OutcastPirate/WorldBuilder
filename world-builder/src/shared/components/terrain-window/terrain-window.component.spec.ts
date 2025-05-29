import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerrainWindowComponent } from './terrain-window.component';

describe('TerrainWindowComponent', () => {
  let component: TerrainWindowComponent;
  let fixture: ComponentFixture<TerrainWindowComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerrainWindowComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(TerrainWindowComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
