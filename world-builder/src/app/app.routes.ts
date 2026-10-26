import { Routes } from '@angular/router';
import { MainViewComponent } from '../shared/views/main-view/main-view.component';
import { SceneMenuComponent } from '../shared/components/scene-menu/scene-menu.component';
import { ObjectsTabComponent } from '../shared/components/objects-tab/objects-tab.component';
import { TerrainPanelComponent } from '../shared/components/terrain-panel/terrain-panel.component';
import { TexturingPanelComponent } from '../shared/components/texturing-panel/texturing-panel.component';
import { ExportPanelComponent } from '../shared/components/export-panel/export-panel.component';

export const routes: Routes = [
  {
    path: '',
    component: MainViewComponent,
    children: [
      // Terrain comes first, as in the article's workflow (Figure 5).
      { path: '', redirectTo: 'terrainMenu', pathMatch: 'full' },
      { path: 'terrainMenu', component: TerrainPanelComponent },
      { path: 'texturingMenu', component: TexturingPanelComponent },
      { path: 'objectsMenu', component: ObjectsTabComponent },
      { path: 'sceneMenu', component: SceneMenuComponent },
      { path: 'exportMenu', component: ExportPanelComponent },
    ],
  },
];
