import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SceneMenuComponent } from './scene-menu.component';

describe('SceneMenuComponent', () => {
  let component: SceneMenuComponent;
  let fixture: ComponentFixture<SceneMenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SceneMenuComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(SceneMenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
