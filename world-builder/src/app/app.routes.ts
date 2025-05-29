import { Routes } from '@angular/router';
import { MainViewComponent } from '../shared/views/main-view/main-view.component';
import { Component } from '@angular/core';
import { SceneMenuComponent } from '../shared/components/scene-menu/scene-menu.component';
import { ObjectsmenuComponent } from '../shared/components/objectsmenu/objectsmenu.component';

export const routes: Routes = [
  {
    path: '',
    component: MainViewComponent,
    children: [
      { path: '', component: SceneMenuComponent },
      { path: 'sceneMenu', component: SceneMenuComponent },
      { path: 'objectsMenu', component: ObjectsmenuComponent },
    ],
  },
];
