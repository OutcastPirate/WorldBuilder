import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObjectsTabComponent } from './objects-tab.component';

describe('ObjectsTabComponent', () => {
  let component: ObjectsTabComponent;
  let fixture: ComponentFixture<ObjectsTabComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectsTabComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ObjectsTabComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
