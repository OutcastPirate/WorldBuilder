import { Component } from '@angular/core';
import { TerrainWindowComponent } from '../../components/terrain-window/terrain-window.component';
import { OptionsMenuComponent } from '../../components/options-menu/options-menu.component';

@Component({
  selector: 'app-main-view',
  standalone: true,
  imports: [TerrainWindowComponent, OptionsMenuComponent],
  templateUrl: './main-view.component.html',
  styleUrl: './main-view.component.scss',
})
export class MainViewComponent {}
