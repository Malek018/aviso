import {NextResponse} from 'next/server';
import {db} from '@/lib/db';

export async function GET(_: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const e = await db.establishment.findUnique({
    where: {id},
    include: {reviews: {orderBy: {createdAt: 'desc'}, take: 20}},
  });
  if (!e) return NextResponse.json({error: 'Introuvable'}, {status: 404});
  const onsite = e.reviews.filter((r: any) => r.type === 'ONSITE');
  const avis = onsite.length;
  const oui = onsite.filter((r: any) => r.recommendation).length;
  const pct = avis ? Math.round((oui / avis) * 100) : null;
  return NextResponse.json({...e, pct, avis});
}

// Utilisé par l'espace admin (démo) pour réactiver un établissement désactivé.
export async function PATCH(req: Request, {params}: {params: Promise<{id: string}>}) {
  const {id} = await params;
  const b = await req.json();
  if (b.action === 'reactivate') {
    const e = await db.establishment.update({where: {id}, data: {status: 'ACTIVE', disabledReason: null}});
    return NextResponse.json(e);
  }
  return NextResponse.json({error: 'Action inconnue'}, {status: 400});
}
