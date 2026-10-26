import { Component, OnDestroy, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { combineLatest, Subscription } from 'rxjs';
import { AssetLibraryService } from '../../services/asset-library.service';
import { Selection, SelectionService, TransformMode } from '../../services/selection.service';

// Bar over the 3D view: what is selected and what can be done with it, or
// the prompt while placing a model by clicking.
@Component({
  selector: 'app-selection-bar',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './selection-bar.component.html',
  styleUrl: './selection-bar.component.scss',
})
export class SelectionBarComponent implements OnInit, OnDestroy {
  constructor(
    public selectionService: SelectionService,
    private library: AssetLibraryService
  ) {}

  selection: Selection | null = null;
  placingName: string | null = null;
  mode: TransformMode = 'translate';
  description = { name: '', detail: '' };

  private subscription!: Subscription;

  ngOnInit(): void {
    this.subscription = combineLatest([
      this.selectionService.selection$,
      this.selectionService.placingAssetId$,
      this.selectionService.mode$,
    ]).subscribe(([selection, placingId, mode]) => {
      this.selection = selection;
      this.mode = mode;
      this.placingName = placingId ? this.library.find(placingId)?.name ?? placingId : null;
      if (selection) this.description = this.selectionService.describe(selection);
    });
  }

  ngOnDestroy(): void {
    this.subscription.unsubscribe();
  }
}
