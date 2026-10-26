import { Object3D } from 'three';

export interface AssetInterface {
  name: string;
  object: Object3D;
  keepRatio: boolean;
  isMesh?: boolean;
  // Library model this object was made from (placed by clicking, or a
  // generated object made editable).
  assetId?: string;
  // Keep the object standing on the ground when it is moved or the terrain
  // changes. When off, its height stays where the user puts it.
  snapToGround?: boolean;
}

export class AssetInstance implements AssetInterface {
  name: string;
  object: Object3D;
  keepRatio: boolean;
  isMesh?: boolean;
  assetId?: string;
  snapToGround = true;

  constructor(
    name: string,
    object: Object3D,
    isMesh: boolean = false,
    keepRatio: boolean = true,
    assetId?: string
  ) {
    this.name = name;
    this.object = object;
    this.isMesh = isMesh;
    this.keepRatio = keepRatio;
    this.assetId = assetId;
  }
}
