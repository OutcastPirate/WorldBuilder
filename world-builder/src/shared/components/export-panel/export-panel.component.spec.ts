import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ExportPanelComponent } from './export-panel.component';

describe('ExportPanelComponent', () => {
  let component: ExportPanelComponent;
  let fixture: ComponentFixture<ExportPanelComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ExportPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ExportPanelComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('asks for a terrain before exporting', () => {
    expect(component.ready).toBeFalse();
    expect(fixture.nativeElement.textContent).toContain('Generate a terrain first.');
  });
});
