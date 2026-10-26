import { ComponentFixture, TestBed } from '@angular/core/testing';
import { DialogRef } from '@angular/cdk/dialog';

import { ObjectDialogComponent } from './object-dialog.component';

describe('ObjectDialogComponent', () => {
  let component: ObjectDialogComponent;
  let fixture: ComponentFixture<ObjectDialogComponent>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ObjectDialogComponent],
      providers: [{ provide: DialogRef, useValue: { close: () => {} } }]
    })
    .compileComponents();
    
    fixture = TestBed.createComponent(ObjectDialogComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
