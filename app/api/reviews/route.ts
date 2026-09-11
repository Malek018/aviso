import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {checkDisable} from '@/lib/business-rules';

export async function POST(req: Request) {
  const b = await req.json();
  if (!b.establishmentId || typeof b.recommendation !== 'boolean') {
    return NextResponse.json({error: 'Données invalides'}, {status: 400});
  }
  const r = await db.review.create({
    data: {
      establishmentId: b.establishmentId,
      recommendation: b.recommendation,
      text: b.text?.trim() || (b.recommendation ? 'Recommande ce lieu.' : 'Ne recommande pas ce lieu.'),
      type: b.type === 'GENERAL' ? 'GENERAL' : 'ONSITE',
    },
  });
  // Seuls les avis vérifiés sur place comptent pour le seuil de désactivation.
  if (r.type === 'ONSITE') await checkDisable(b.establishmentId);
  return NextResponse.json(r, {status: 201});
}
