import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ObjectsmenuComponent } from './objectsmenu.component';

describe('ObjectsmenuComponent', () => {
  let component: ObjectsmenuComponent;
  let fixture: ComponentFixture<ObjectsmenuComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectsmenuComponent]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ObjectsmenuComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
