import * as THREE from 'three';
import { writeObj } from './obj-writer';

describe('writeObj', () => {
  it('writes vertices in world space, faces and materials', () => {
    const root = new THREE.Group();
    const red = new THREE.MeshStandardMaterial({ color: 0xff0000, name: 'Red paint' });
    const cube = new THREE.Mesh(new THREE.BoxGeometry(2, 2, 2), red);
    cube.name = 'Cube';
    cube.position.set(10, 0, 0);
    root.add(cube);

    const { obj, mtl, textures } = writeObj(root, 'world.mtl');
    const lines = obj.split('\n');
    const vertices = lines.filter((l) => l.startsWith('v '));
    const faces = lines.filter((l) => l.startsWith('f '));

    expect(lines).toContain('mtllib world.mtl');
    expect(lines).toContain('o Cube');
    expect(lines).toContain('usemtl Red_paint');
    expect(vertices.length).toBe(24); // BoxGeometry: 4 vertices × 6 sides
    expect(faces.length).toBe(12); // 2 triangles × 6 sides
    // Moved 10 m along X: every x is 9 or 11.
    expect(vertices.every((v) => ['9', '11'].includes(v.split(' ')[1]))).toBeTrue();
    expect(mtl).toContain('newmtl Red_paint');
    expect(mtl).toContain('Kd 1 0 0');
    expect(textures.length).toBe(0);
  });

  it('numbers vertices across several meshes and references textures', () => {
    const canvas = document.createElement('canvas');
    const textured = new THREE.MeshStandardMaterial({ map: new THREE.CanvasTexture(canvas), name: 'Terrain' });
    const root = new THREE.Group().add(
      new THREE.Mesh(new THREE.PlaneGeometry(), textured),
      new THREE.Mesh(new THREE.PlaneGeometry(), new THREE.MeshStandardMaterial())
    );
    const { obj, mtl, textures } = writeObj(root, 'world.mtl');
    const faces = obj.split('\n').filter((l) => l.startsWith('f '));
    // Second plane's faces refer to vertices 5–8.
    expect(faces[2].split(' ').slice(1).every((c) => Number(c.split('/')[0]) >= 5)).toBeTrue();
    expect(mtl).toContain('map_Kd Terrain.png');
    expect(textures.map((t) => t.name)).toEqual(['Terrain.png']);
  });
});
