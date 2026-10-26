import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TexturingPanelComponent } from './texturing-panel.component';
import { GenerationConfigService } from '../../services/generation-config.service';

describe('TexturingPanelComponent', () => {
  let component: TexturingPanelComponent;
  let fixture: ComponentFixture<TexturingPanelComponent>;
  let config: GenerationConfigService;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TexturingPanelComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TexturingPanelComponent);
    component = fixture.componentInstance;
    config = TestBed.inject(GenerationConfigService);
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('keeps thresholds in order and apart', () => {
    component.setThreshold(0, 0.9);
    expect(config.config.texturing.thresholds[0]).toBe(0.54);
    component.setThreshold(2, 0.1);
    expect(config.config.texturing.thresholds[2]).toBe(0.56);
  });

  it('marks the preset as modified after an edit', () => {
    expect(component.modified).toBeFalse();
    component.updateZone(1, { color: '#000000' });
    expect(component.modified).toBeTrue();
    component.applyPreset('builtin-temperate');
    expect(component.modified).toBeFalse();
  });
});
