import {NextResponse} from 'next/server';
import {db} from '@/lib/db';
import {checkDisable, DISABLE_THRESHOLD} from '@/lib/business-rules';

// Outil de démonstration : ajoute d'un coup une série d'avis "Non" vérifiés
// sur place pour un établissement actif, afin de déclencher le seuil de
// désactivation sans attendre de vrais avis négatifs.
export async function POST(req: Request) {
  const {establishmentId} = await req.json();
  if (!establishmentId) return NextResponse.json({error: 'establishmentId requis'}, {status: 400});
  const onsite = await db.review.findMany({where: {establishmentId, type: 'ONSITE'}, select: {recommendation: true}});
  const oui = onsite.filter((r: any) => r.recommendation).length;
  const non = onsite.length - oui;
  const target = DISABLE_THRESHOLD / 100 - 0.1; // marge pour bien passer sous le seuil
  const needed = Math.max(5, Math.ceil(oui / Math.max(target, 0.01) - oui - non));
  await db.review.createMany({
    data: Array.from({length: needed}, () => ({
      establishmentId,
      recommendation: false,
      text: 'Avis simulé (démo).',
      type: 'ONSITE' as const,
    })),
  });
  await checkDisable(establishmentId);
  return NextResponse.json({added: needed});
}
