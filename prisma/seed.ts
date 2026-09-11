import {PrismaClient} from '@prisma/client';
const db = new PrismaClient();

const onsiteTexts = {
  oui: [
    'Recommande ce lieu, service à la hauteur.',
    'Bonne expérience, je reviendrai.',
    'Conforme à ce qui était annoncé.',
    'Accueil correct, rien à signaler.',
  ],
  non: ['Ne recommande pas, expérience décevante.', 'Attente trop longue par rapport au prix.'],
};

const rows = [
  {
    name: 'Chez Mama Restaurant', category: 'Restaurant', city: 'Cotonou',
    address: "Cotonou, quartier Gbégamey, à deux pas de l'ENEAM, sur l'axe qui mène vers le marché Dantokpa.",
    description: 'Cuisine béninoise traditionnelle préparée à la demande. Terrasse couverte, service rapide même aux heures de pointe.',
    price: '1 500 – 4 000 FCFA le plat', availability: 'Tous les jours, 11h–22h',
    formalised: true, statusOpen: true, latitude: 6.3703, longitude: 2.4189,
    sinceYear: 2021, mapsQuery: 'ENEAM, Gbégamey, Cotonou, Bénin',
    pct: 82, avis: 47,
  },
  {
    name: 'Koffi Barber', category: 'Coiffeur', city: 'Abomey-Calavi',
    address: "Abomey-Calavi, quartier Kpanroun, juste à l'entrée du campus de l'Université d'Abomey-Calavi (UAC), au-dessus d'une papeterie.",
    description: 'Barbier spécialisé dégradés et tailles de barbe, sur rendez-vous WhatsApp de préférence.',
    price: '1 000 – 3 000 FCFA', availability: 'Mar–Dim, 9h–19h · Fermé le lundi',
    formalised: false, statusOpen: false, latitude: 6.4102, longitude: 2.3358,
    sinceYear: 2022, mapsQuery: "Université d'Abomey-Calavi, Kpanroun, Bénin",
    pct: 91, avis: 96,
  },
  {
    name: 'Résidence Étoile', category: 'Appartement meublé', city: 'Cotonou',
    address: 'Cotonou, Fidjrossè Kpota, à deux rues de la Route des Pêches.',
    description: 'Appartements meublés avec Wi-Fi, climatisation et parking sécurisé. Idéal pour un séjour court ou moyen terme.',
    price: '25 000 – 40 000 FCFA / nuit', availability: 'Disponibilité variable selon les dates — contacter pour réservation',
    formalised: true, statusOpen: true, latitude: 6.3521, longitude: 2.3897,
    sinceYear: 2020, mapsQuery: 'Route des Pêches, Fidjrossè, Cotonou, Bénin',
    pct: 88, avis: 74,
  },
  {
    name: 'Rapido Delivery', category: 'Livraison', city: 'Cotonou',
    address: 'Cotonou, quartier Ganhi, non loin de l’échangeur Steinmetz, entre la Poste du Bénin et le marché Dantokpa.',
    description: 'Service de livraison à moto pour repas, colis et courses. Suivi de commande par WhatsApp.',
    price: '500 – 1 500 FCFA selon la distance', availability: 'Tous les jours, 7h–23h',
    formalised: false, statusOpen: true, latitude: 6.37, longitude: 2.42,
    sinceYear: 2023, mapsQuery: 'Marché Dantokpa, Ganhi, Cotonou, Bénin', noGate: true,
    pct: 79, avis: 35,
  },
];

async function main() {
  await db.review.deleteMany();
  await db.establishment.deleteMany();
  for (const {pct, avis, ...data} of rows) {
    const e = await db.establishment.create({data});
    const oui = Math.round((pct / 100) * avis);
    for (let i = 0; i < avis; i++) {
      const isOui = i < oui;
      const pool = isOui ? onsiteTexts.oui : onsiteTexts.non;
      await db.review.create({
        data: {
          establishmentId: e.id,
          recommendation: isOui,
          text: pool[i % pool.length],
          type: 'ONSITE',
        },
      });
    }
  }
}
main().finally(() => db.$disconnect());
