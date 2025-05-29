import { Object3D } from 'three';

export interface AssetInterface {
  name: string;
  object: Object3D;
  keepRatio: boolean;
  isMesh?: boolean;
}

export class AssetInstance implements AssetInterface {
  name: string;
  object: Object3D;
  keepRatio: boolean;
  isMesh?: boolean;

  constructor(
    name: string,
    object: Object3D,
    isMesh: boolean = false,
    keepRatio: boolean = true
  ) {
    this.name = name;
    this.object = object;
    this.isMesh = isMesh;
    this.keepRatio = keepRatio;
  }
}
