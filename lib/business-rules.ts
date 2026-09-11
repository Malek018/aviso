import {db} from '@/lib/db';

export const DISABLE_THRESHOLD = 40;
export const MIN_SAMPLE = 5;
export const RADIUS_M = 200;
export const REQUIRED_MIN = 15;

// Recalcule le taux de recommandation d'un établissement et le désactive
// automatiquement si le taux tombe à DISABLE_THRESHOLD% ou moins sur au
// moins MIN_SAMPLE avis vérifiés sur place (type ONSITE).
export async function checkDisable(establishmentId: string) {
  const e = await db.establishment.findUnique({where: {id: establishmentId}});
  if (!e || e.status === 'DISABLED') return;
  const onsite = await db.review.findMany({where: {establishmentId, type: 'ONSITE'}, select: {recommendation: true}});
  const total = onsite.length;
  if (total < MIN_SAMPLE) return;
  const oui = onsite.filter((r: any) => r.recommendation).length;
  const pct = Math.round((oui / total) * 100);
  if (pct <= DISABLE_THRESHOLD) {
    await db.establishment.update({
      where: {id: establishmentId},
      data: {
        status: 'DISABLED',
        disabledReason: `Taux de recommandation (${pct}%) sous le seuil minimal de ${DISABLE_THRESHOLD}%, sur ${total} avis vérifiés sur place.`,
      },
    });
  }
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371000, toRad = (x: number) => (x * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
