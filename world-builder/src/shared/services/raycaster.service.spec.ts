import { TestBed } from '@angular/core/testing';

import { RaycasterService } from './raycaster.service';

describe('RaycasterService', () => {
  let service: RaycasterService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(RaycasterService);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
