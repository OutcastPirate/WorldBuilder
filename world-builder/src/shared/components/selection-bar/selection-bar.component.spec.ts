import { ComponentFixture, TestBed } from '@angular/core/testing';

import { SelectionBarComponent } from './selection-bar.component';

describe('SelectionBarComponent', () => {
  let component: SelectionBarComponent;
  let fixture: ComponentFixture<SelectionBarComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [SelectionBarComponent]
    })
    .compileComponents();

    fixture = TestBed.createComponent(SelectionBarComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });

  it('shows nothing while nothing is selected', () => {
    expect(fixture.nativeElement.querySelector('.bar')).toBeNull();
  });
});
