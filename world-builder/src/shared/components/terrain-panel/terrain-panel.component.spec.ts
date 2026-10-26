import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TerrainPanelComponent } from './terrain-panel.component';

describe('TerrainPanelComponent', () => {
  let component: TerrainPanelComponent;
  let fixture: ComponentFixture<TerrainPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TerrainPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TerrainPanelComponent);
    component = fixture.componentInstance;

    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
