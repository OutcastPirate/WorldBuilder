import { PlacementCategoryId } from '../generation/config';

// Entry of src/assets/predefined/manifest.json. Paths are relative to
// assets/predefined/.
export interface PredefinedAsset {
  id: string;
  name: string;
  file: string;
  material?: string;
  // Library category for automatic placement (omit for hand-placed only).
  category?: PlacementCategoryId;
  // Height in metres the model is scaled to when placed automatically.
  height?: number;
  // Replaces the model's materials when placed automatically (for models
  // without a material file, or with unusable colours).
  color?: string;
  // Shown next to the model in the placement panel (e.g. a polygon warning).
  warning?: string;
}
