import {NextResponse} from 'next/server';
import {db} from '@/lib/db';

// Vue interne (démo) : tous les établissements, quel que soit leur statut.
export async function GET() {
  const rows = await db.establishment.findMany({
    include: {reviews: {where: {type: 'ONSITE'}, select: {recommendation: true}}},
    orderBy: {createdAt: 'desc'},
  });
  const out = rows.map((row: any) => {
    const {reviews, ...e} = row;
    const avis = reviews.length;
    const oui = reviews.filter((r: any) => r.recommendation).length;
    const pct = avis ? Math.round((oui / avis) * 100) : null;
    return {...e, pct, avis};
  });
  return NextResponse.json(out);
}
