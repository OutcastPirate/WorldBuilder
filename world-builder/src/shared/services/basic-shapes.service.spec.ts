import { TestBed } from '@angular/core/testing';

import { BasicShapesService } from './basic-shapes.service';

describe('BasicShapesService', () => {
  let service: BasicShapesService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(BasicShapesService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
