import {NextResponse} from 'next/server';
import {db} from '@/lib/db';

// Le taux de recommandation affiché ne compte que les avis vérifiés sur
// place (ONSITE) — les avis généraux sont informatifs mais n'entrent pas
// dans le calcul de la confiance ni dans le seuil de désactivation.
export async function GET() {
  const rows = await db.establishment.findMany({
    where: {status: 'ACTIVE'},
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

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.name || !b.category || !b.city) {
    return NextResponse.json({error: 'Nom, catégorie et ville sont requis.'}, {status: 400});
  }
  const e = await db.establishment.create({
    data: {
      name: b.name,
      category: b.category,
      city: b.city,
      address: b.address || '',
      phone: b.phone || null,
      description: b.description || null,
      price: b.price || null,
      availability: b.availability || null,
      mapsQuery: b.mapsQuery || null,
      formalised: b.mode === 'owner' && !!b.ifu,
      // "C'est mon établissement" publie tout de suite ; une recommandation
      // par un tiers passe par la vérification de l'équipe avant publication.
      status: b.mode === 'recommend' ? 'PENDING' : 'ACTIVE',
    },
  });
  return NextResponse.json(e, {status: 201});
}
