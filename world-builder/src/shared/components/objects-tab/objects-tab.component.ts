import { Component } from '@angular/core';
import { ObjectsmenuComponent } from '../objectsmenu/objectsmenu.component';
import { PlacementPanelComponent } from '../placement-panel/placement-panel.component';

type ObjectsView = 'generated' | 'manual';

// Objects tab: automatic placement and the hand-placed objects list.
@Component({
  selector: 'app-objects-tab',
  standalone: true,
  imports: [PlacementPanelComponent, ObjectsmenuComponent],
  template: `
    <div class="switch" role="tablist">
      <button role="tab" [class.active]="view === 'generated'" [attr.aria-selected]="view === 'generated'"
        (click)="setView('generated')">Generated</button>
      <button role="tab" [class.active]="view === 'manual'" [attr.aria-selected]="view === 'manual'"
        (click)="setView('manual')">Hand-placed</button>
    </div>
    @if (view === 'generated') {
      <app-placement-panel></app-placement-panel>
    } @else {
      <app-objectsmenu></app-objectsmenu>
    }
  `,
  styles: [
    `
      :host { display: flex; flex-direction: column; flex: 1 1 auto; width: 100%; min-height: 0; gap: 10px; }
      .switch { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; padding: 0px 10px; }
      .switch button { padding: 6px 10px; }
    `,
  ],
})
export class ObjectsTabComponent {
  // Remembered while switching between side-menu tabs.
  private static lastView: ObjectsView = 'generated';

  view: ObjectsView = ObjectsTabComponent.lastView;

  setView(view: ObjectsView): void {
    this.view = view;
    ObjectsTabComponent.lastView = view;
  }
}
