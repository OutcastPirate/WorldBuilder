import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PlacementPanelComponent } from './placement-panel.component';

describe('PlacementPanelComponent', () => {
  let component: PlacementPanelComponent;
  let fixture: ComponentFixture<PlacementPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PlacementPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(PlacementPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
