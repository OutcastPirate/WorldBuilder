import { NoiseFunction2D } from 'simplex-noise';
import { NoiseParams } from './config';

// Fractal Brownian motion, equation (1) of the article with the octave
// frequency growing by λ^k (each octave adds finer detail):
//
//   h = Σ_{k=0}^{K-1} p^k · SN(x·λ^k / s, y·λ^k / s)  /  Σ_{k=0}^{K-1} p^k
//
// Dividing by the sum of amplitudes keeps the result in [-1, 1].
export function fbm(
  noise: NoiseFunction2D,
  x: number,
  y: number,
  params: NoiseParams
): number {
  let amplitude = 1;
  let frequency = 1 / params.scale;
  let sum = 0;
  let amplitudeSum = 0;

  for (let k = 0; k < params.octaves; k++) {
    sum += amplitude * noise(x * frequency, y * frequency);
    amplitudeSum += amplitude;
    amplitude *= params.persistence;
    frequency *= params.lacunarity;
  }
  return sum / amplitudeSum;
}
