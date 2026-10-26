import * as THREE from 'three';

export interface ObjOutput {
  obj: string;
  mtl: string;
  // Texture images referenced by the MTL (map_Kd), by file name.
  textures: { name: string; image: CanvasImageSource }[];
}

// Writes meshes (with their world transforms) as Wavefront OBJ + MTL.
// three.js's OBJExporter writes no material file and skips instanced
// meshes, so this small writer is used instead. Instanced meshes must be
// expanded into plain meshes first.
export function writeObj(root: THREE.Object3D, mtlFileName: string): ObjOutput {
  root.updateMatrixWorld(true);
  const lines = ['# World Builder export', `mtllib ${mtlFileName}`];
  // Each material with its OBJ name and a geometry that uses it (for the
  // average colour of vertex-coloured materials).
  const materials = new Map<THREE.Material, { name: string; geometry: THREE.BufferGeometry }>();
  const textures: ObjOutput['textures'] = [];
  const usedNames = new Set<string>();
  let vertexOffset = 1;
  let uvOffset = 1;
  let normalOffset = 1;

  const vertex = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const normalMatrix = new THREE.Matrix3();

  const materialName = (material: THREE.Material, geometry: THREE.BufferGeometry): string => {
    let entry = materials.get(material);
    if (!entry) {
      entry = { name: unique(sanitize(material.name || `material_${materials.size + 1}`), usedNames), geometry };
      materials.set(material, entry);
    }
    return entry.name;
  };

  root.traverse((child) => {
    if (!(child instanceof THREE.Mesh) || child instanceof THREE.InstancedMesh) return;
    const geometry = child.geometry as THREE.BufferGeometry;
    const position = geometry.attributes['position'];
    const uv = geometry.attributes['uv'];
    const normals = geometry.attributes['normal'];
    if (!position) return;

    lines.push(`o ${sanitize(child.name || child.parent?.name || 'mesh')}`);
    normalMatrix.getNormalMatrix(child.matrixWorld);
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(child.matrixWorld);
      lines.push(`v ${fmt(vertex.x)} ${fmt(vertex.y)} ${fmt(vertex.z)}`);
    }
    if (uv) {
      for (let i = 0; i < uv.count; i++) lines.push(`vt ${fmt(uv.getX(i))} ${fmt(uv.getY(i))}`);
    }
    if (normals) {
      for (let i = 0; i < normals.count; i++) {
        normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
        lines.push(`vn ${fmt(normal.x)} ${fmt(normal.y)} ${fmt(normal.z)}`);
      }
    }

    const index = geometry.index;
    const count = index ? index.count : position.count;
    const groups = geometry.groups.length > 0 ? geometry.groups : [{ start: 0, count, materialIndex: 0 }];
    const corner = (i: number) => {
      const v = (index ? index.getX(i) : i);
      const parts = [String(v + vertexOffset), uv ? String(v + uvOffset) : '', normals ? String(v + normalOffset) : ''];
      return normals ? parts.join('/') : uv ? `${parts[0]}/${parts[1]}` : parts[0];
    };

    for (const group of groups) {
      const material = Array.isArray(child.material)
        ? child.material[group.materialIndex ?? 0]
        : child.material;
      if (material) lines.push(`usemtl ${materialName(material, geometry)}`);
      const end = Math.min(group.start + group.count, count);
      for (let i = group.start; i + 2 < end; i += 3) {
        lines.push(`f ${corner(i)} ${corner(i + 1)} ${corner(i + 2)}`);
      }
    }

    vertexOffset += position.count;
    if (uv) uvOffset += uv.count;
    if (normals) normalOffset += normals.count;
  });

  const mtl = ['# World Builder export'];
  materials.forEach(({ name, geometry }, material) => {
    const color = materialColor(material, geometry);
    mtl.push('', `newmtl ${name}`, `Kd ${fmt(color.r)} ${fmt(color.g)} ${fmt(color.b)}`, 'Ka 0 0 0', 'Ks 0 0 0', 'd 1', 'illum 1');
    const map = (material as THREE.MeshStandardMaterial).map;
    if (map?.image) {
      const textureName = `${name}.png`;
      textures.push({ name: textureName, image: map.image as CanvasImageSource });
      mtl.push(`map_Kd ${textureName}`);
    }
  });

  return { obj: lines.join('\n') + '\n', mtl: mtl.join('\n') + '\n', textures };
}

// Diffuse colour in sRGB. A textured material is white (the texture holds
// the colour); a vertex-coloured one uses the average of its vertex colours.
function materialColor(material: THREE.Material, geometry: THREE.BufferGeometry): THREE.Color {
  const base = (material as THREE.MeshStandardMaterial).color?.clone() ?? new THREE.Color(1, 1, 1);
  const colors = geometry.attributes['color'];
  if ((material as THREE.MeshStandardMaterial).vertexColors && colors) {
    const sum = new THREE.Color(0, 0, 0);
    for (let i = 0; i < colors.count; i++) {
      sum.r += colors.getX(i);
      sum.g += colors.getY(i);
      sum.b += colors.getZ(i);
    }
    base.multiply(new THREE.Color(sum.r / colors.count, sum.g / colors.count, sum.b / colors.count));
  }
  const srgb = { r: 0, g: 0, b: 0 };
  base.getRGB(srgb, THREE.SRGBColorSpace);
  return new THREE.Color(srgb.r, srgb.g, srgb.b);
}

function fmt(value: number): string {
  return Number(value.toFixed(5)).toString();
}

function sanitize(name: string): string {
  return name.trim().replace(/[^\w.\-]+/g, '_') || 'item';
}

function unique(name: string, used: Set<string>): string {
  let candidate = name;
  for (let n = 2; used.has(candidate); n++) candidate = `${name}_${n}`;
  used.add(candidate);
  return candidate;
}
