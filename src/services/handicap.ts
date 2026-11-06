// Corrected time from elapsed time, per rating system.
import { HandicapSystem } from '../types/regatta';

/**
 * IRC and ORC ratings are time-correction factors: corrected = elapsed × TCC.
 * Portsmouth Yardstick is the other way round: corrected = elapsed × 1000 ÷ Portsmouth Number,
 * so a slower boat (higher number) gets time taken off. A number under 100 is read as the
 * ratio form (1.100 for PN 1100), which is what the boat form used to suggest.
 */
export function correctedSeconds(elapsedSec: number, system: HandicapSystem | undefined, rating: number | undefined): number {
  const elapsed = Number.isFinite(elapsedSec) ? elapsedSec : 0;
  if (typeof rating !== 'number' || !Number.isFinite(rating) || rating <= 0) return elapsed;
  if (system === 'PY') {
    const pn = rating >= 100 ? rating : rating * 1000;
    return (elapsed * 1000) / pn;
  }
  return elapsed * rating;
}
